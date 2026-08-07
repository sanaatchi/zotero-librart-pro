// @ajan: cursor · @etiket: katman-3, citation-key, kp-preserve, dual-writer
import { lookupEdition, nextCkCode } from "./localBookDb";
import { normalizeKp } from "./kpToken";

export {
  getCitationKeyFromExtra,
  assignCitationKey,
  ensureCitationKey,
  shouldSkipCitationKeyWrite,
};

const CITATION_KEY_LINE = /^Citation Key:\s*(.+)$/im;

function getCitationKeyFromExtra(item: Zotero.Item): string | null {
  const extra = (item.getField("extra") as string) || "";
  const m = extra.match(CITATION_KEY_LINE);
  return m ? m[1].trim() : null;
}

/** True when Extra already has any Citation Key line (incl. valid KP). */
function shouldSkipCitationKeyWrite(extra: string): boolean {
  const m = String(extra || "").match(CITATION_KEY_LINE);
  return !!(m && m[1].trim());
}

/**
 * Write Citation Key only when missing. Never replace an existing line —
 * especially never wipe a valid KP (K1 package import owns KP on this bus).
 * Returns false if write was skipped.
 */
function setCitationKeyInExtra(item: Zotero.Item, key: string): boolean {
  const extra = (item.getField("extra") as string) || "";
  if (shouldSkipCitationKeyWrite(extra)) {
    // Re-read guard vs concurrent K1 write: keep existing KP/CK/BBT.
    return false;
  }
  item.setField(
    "extra",
    extra ? `${extra}\nCitation Key: ${key}` : `Citation Key: ${key}`,
  );
  return true;
}

/**
 * Ensure the item has a Citation Key (`ensureCitationKey` alias).
 * Policy: if Citation Key already valid KP-shaped, return it — do not
 * regenerate Better BibTeX / CKxxxxxx over KP. Any other existing key is
 * also preserved (no blind dual overwrite).
 */
async function assignCitationKey(item: Zotero.Item): Promise<string> {
  const existing = getCitationKeyFromExtra(item);
  if (existing) {
    const asKp = normalizeKp(existing);
    if (asKp) return asKp;
    return existing;
  }

  let key: string | null = null;
  const isbn = item.getField("ISBN") as string;
  if (isbn) {
    const record = await lookupEdition(isbn);
    if (record?.kutuphaneKp) key = record.kutuphaneKp;
  }
  if (!key) key = await nextCkCode();

  const wrote = setCitationKeyInExtra(item, key);
  if (!wrote) {
    // Race: another writer (e.g. K1) filled Citation Key between read and write.
    const again = getCitationKeyFromExtra(item);
    if (again) {
      const asKp = normalizeKp(again);
      return asKp || again;
    }
  }
  await item.saveTx({ skipSelect: true, skipNotifier: true });
  return key;
}

/** Alias — same policy as assignCitationKey. */
const ensureCitationKey = assignCitationKey;
