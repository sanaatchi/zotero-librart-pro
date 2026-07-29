// Adapted from zotero-reference (AGPL-3.0) src/modules/pdf.ts

import { getReferenceUtils } from "../vendor/zotero-reference";

export { extractReferencesFromPdf };

/**
 * Extract bibliography entries from the active PDF reader using the
 * zotero-reference PDF parser (regex line merge + refText2Info).
 */
async function extractReferencesFromPdf(
  reader: _ZoteroTypes.ReaderInstance,
  fromCurrentPage = false,
): Promise<ItemInfo[]> {
  return getReferenceUtils().PDF.getReferences(reader, fromCurrentPage);
}
