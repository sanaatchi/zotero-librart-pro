import { lookupEdition, nextCkCode } from "./localBookDb";

export { getCitationKeyFromExtra, assignCitationKey };

const CITATION_KEY_LINE = /^Citation Key:\s*(.+)$/im;

function getCitationKeyFromExtra(item: Zotero.Item): string | null {
  const extra = (item.getField("extra") as string) || "";
  const m = extra.match(CITATION_KEY_LINE);
  return m ? m[1].trim() : null;
}

function setCitationKeyInExtra(item: Zotero.Item, key: string): void {
  const extra = (item.getField("extra") as string) || "";
  if (CITATION_KEY_LINE.test(extra)) {
    item.setField(
      "extra",
      extra.replace(CITATION_KEY_LINE, `Citation Key: ${key}`),
    );
  } else {
    item.setField(
      "extra",
      extra ? `${extra}\nCitation Key: ${key}` : `Citation Key: ${key}`,
    );
  }
}

/**
 * Ensure the item has a Citation Key. Reuses Kutuphane's real "KPxxxxxx"
 * code when the ISBN already resolves to one (read-only reuse — never
 * allocated by us); otherwise mints our own "CKxxxxxx" code, which lives
 * in a namespace that can never collide with Kutuphane's KP registry.
 * No-op (returns the existing key) if the item already has one.
 */
async function assignCitationKey(item: Zotero.Item): Promise<string> {
  const existing = getCitationKeyFromExtra(item);
  if (existing) return existing;

  let key: string | null = null;
  const isbn = item.getField("ISBN") as string;
  if (isbn) {
    const record = await lookupEdition(isbn);
    if (record?.kutuphaneKp) key = record.kutuphaneKp;
  }
  if (!key) key = await nextCkCode();

  setCitationKeyInExtra(item, key);
  await item.saveTx({ skipSelect: true, skipNotifier: true });
  return key;
}
