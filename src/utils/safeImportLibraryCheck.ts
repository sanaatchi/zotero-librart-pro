// @ajan: cursor · @etiket: f2, safe-import, library-check
import { searchItemByDoi, searchItemByTitle } from "./libraryMatch";
import type { ImportPreviewRow } from "./safeImportTypes";

export { enrichLibraryDuplicates };

function doiFromIdentifier(identifier?: string): string | null {
  if (!identifier) return null;
  const m = /^DOI:(.+)$/i.exec(identifier.trim());
  return m ? m[1] : null;
}

async function enrichLibraryDuplicates(
  rows: ImportPreviewRow[],
  libraryID?: number,
): Promise<ImportPreviewRow[]> {
  const out: ImportPreviewRow[] = [];
  for (const row of rows) {
    const warnings = [...row.warnings];
    const doi = doiFromIdentifier(row.identifier);
    let existing: Zotero.Item | null = null;
    if (doi) {
      existing = await searchItemByDoi(doi, libraryID);
    } else if (row.title.trim().length >= 10) {
      existing = await searchItemByTitle(row.title, libraryID);
    }
    if (existing) {
      warnings.push({
        kind: "duplicate-library",
        itemKey: existing.key,
      });
    }
    out.push({ ...row, warnings });
  }
  return out;
}
