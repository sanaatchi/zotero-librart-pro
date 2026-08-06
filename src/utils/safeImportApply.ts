// @ajan: cursor · @etiket: f2, safe-import, apply
// Field mapping adapted from scholar-sidekick-zotero (MIT) src/import/zotero.ts

import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import type { ImportCandidate } from "./safeImportTypes";

export { importSelectedCandidates };

function setFieldSafe(
  item: Zotero.Item,
  field: string,
  value: string | undefined,
): void {
  if (typeof value !== "string" || !value.length) return;
  try {
    item.setField(field, value);
  } catch {
    /* field not valid for item type */
  }
}

function applyRawCslFields(
  item: Zotero.Item,
  raw: Record<string, unknown>,
): void {
  const str = (k: string): string | undefined =>
    typeof raw[k] === "string" ? (raw[k] as string) : undefined;
  setFieldSafe(item, "title", str("title"));
  setFieldSafe(
    item,
    "publicationTitle",
    str("publicationTitle") ?? str("bookTitle"),
  );
  setFieldSafe(item, "journalAbbreviation", str("journalAbbreviation"));
  setFieldSafe(item, "volume", str("volume"));
  setFieldSafe(item, "issue", str("issue"));
  setFieldSafe(item, "pages", str("pages"));
  setFieldSafe(item, "date", str("date"));
  setFieldSafe(item, "DOI", str("DOI"));
  setFieldSafe(item, "ISBN", str("ISBN"));
  setFieldSafe(item, "ISSN", str("ISSN"));
  setFieldSafe(item, "url", str("url"));

  const creators = raw.creators as
    | Array<{
        creatorType?: string;
        firstName?: string;
        lastName?: string;
        name?: string;
      }>
    | undefined;
  if (Array.isArray(creators) && creators.length) {
    // Preserve the parsed role (editor/translator/seriesEditor/...) instead
    // of collapsing everything to "author" — a BibTeX/RIS record for an
    // edited volume or a translated work (e.g. `editor`/`translator` field)
    // previously lost its creators entirely on import: the old filter kept
    // only rows already typed "author" and dropped the rest.
    const mapped = creators
      .filter((c) => c.lastName || c.firstName || c.name)
      .map((c) => ({
        creatorType: c.creatorType || "author",
        lastName: c.lastName,
        firstName: c.firstName,
        name: !c.lastName && c.name ? c.name : undefined,
      }));
    try {
      item.setCreators(mapped as any);
    } catch {
      // Item type doesn't accept one of the parsed roles (e.g. "editor" on
      // a type with no editor slot) — fall back to importing everyone as
      // "author" rather than silently dropping all creators.
      item.setCreators(
        mapped.map((c) => ({ ...c, creatorType: "author" })) as any,
      );
    }
  }
}

async function importSelectedCandidates(
  rows: ImportCandidate[],
  opts: { collectionId?: number | null } = {},
): Promise<{ importedIds: number[]; skipped: number }> {
  const importedIds: number[] = [];
  let skipped = 0;

  await Zotero.DB.executeTransaction(async () => {
    for (const row of rows) {
      if (!row.title.trim() && !row.rawCsl.title) {
        skipped += 1;
        continue;
      }
      const itemType =
        typeof row.rawCsl.itemType === "string"
          ? row.rawCsl.itemType
          : row.itemType;
      const item = new Zotero.Item(itemType as any);
      applyRawCslFields(item, row.rawCsl);
      if (typeof opts.collectionId === "number") {
        item.addToCollection(opts.collectionId);
      }
      const id = await item.save();
      if (typeof id === "number") importedIds.push(id);
    }
  });

  void getZoteroAdapter();
  return { importedIds, skipped };
}
