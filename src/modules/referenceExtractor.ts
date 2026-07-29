// @ajan: claude · @etiket: reference-extractor, menu
// Adapted from zotero-reference (AGPL-3.0) src/modules/pdf.ts

import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getReferenceUtils } from "../vendor/zotero-reference";

export {
  extractReferencesFromPdf,
  onExtractReferences,
  referenceExtractorMenuChild,
};

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

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

function progressLine(message: string) {
  new ztoolkit.ProgressWindow(getString("menu-root"), {
    closeOnClick: true,
    closeOtherProgressWindows: true,
  })
    .createLine({ text: message, type: "default", progress: 100 })
    .show(5000);
}

function getActiveReader(): _ZoteroTypes.ReaderInstance | undefined {
  return Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
}

function formatReferencesNote(references: ItemInfo[]): string {
  const lines = references.map((ref) => {
    const authors = ref.authors?.filter(Boolean).join(", ") || "";
    const year = ref.year ? ` (${ref.year})` : "";
    const doi = ref.identifiers?.DOI ? ` doi:${ref.identifiers.DOI}` : "";
    const sep = authors ? ". " : "";
    return `<p>${authors}${year}${sep}${ref.title}.${doi}</p>`;
  });
  return `<h1>${getString("reference-extractor-note-title")}</h1>${lines.join("")}`;
}

async function saveReferencesAsNote(
  parentItem: Zotero.Item,
  references: ItemInfo[],
): Promise<void> {
  const note = new Zotero.Item("note");
  note.libraryID = parentItem.libraryID;
  note.parentID = parentItem.id;
  note.setNote(formatReferencesNote(references));
  await note.saveTx();
}

/**
 * Menü komutu: aktif PDF okuyucudan kaynakçayı çıkar, ebeveyn öğeye not olarak ekle.
 * En düşük yan-etkili seçenek — mevcut ilişkileri/alanları değiştirmez.
 */
async function onExtractReferences(): Promise<void> {
  const reader = getActiveReader();
  const parentItem = reader?._item?.parentItem as Zotero.Item | undefined;
  if (!reader || !parentItem) {
    alertDialog(getString("reference-extractor-error-no-reader"));
    return;
  }

  let references: ItemInfo[];
  try {
    references = await extractReferencesFromPdf(reader);
  } catch (e) {
    ztoolkit.log("Reference extractor failed", e);
    alertDialog(getString("reference-extractor-error-failed"));
    return;
  }

  if (!references.length) {
    progressLine(getString("reference-extractor-empty"));
    return;
  }

  await saveReferencesAsNote(parentItem, references);
  progressLine(
    getString("reference-extractor-success", {
      args: { count: references.length },
    }),
  );
}

function referenceExtractorMenuChild() {
  return {
    tag: "menuitem" as const,
    id: `${config.addonRef}-reference-extractor`,
    label: getString("menu-reference-extractor"),
    commandListener: () => {
      onExtractReferences();
    },
  };
}
