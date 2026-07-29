// @ajan: cursor · @etiket: f2, safe-import, translate
// Adapted from scholar-sidekick-zotero (MIT) src/ingest/translate.ts

import { buildPreviewRows, cslItemToCandidate } from "./safeImportParse";
import type { ImportPreviewRow } from "./safeImportTypes";

export { parseBibliographyText, parseBibliographyFile };

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `import-${rowSeq}`;
}

type CslItem = Record<string, unknown>;

async function translateString(raw: string): Promise<CslItem[]> {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const translator = new Zotero.Translate.Import();
  translator.setString(trimmed);
  const matches = await translator.getTranslators();
  if (!matches.length) return [];
  translator.setTranslator(matches[0]);
  try {
    return (await translator.translate({ libraryID: false })) as CslItem[];
  } catch (err) {
    ztoolkit.log("safeImport translateString failed", err);
    return [];
  }
}

async function translateFile(path: string): Promise<CslItem[]> {
  const trimmed = path.trim();
  if (!trimmed) return [];
  const translator = new Zotero.Translate.Import();
  translator.setLocation(trimmed);
  const matches = await translator.getTranslators();
  if (!matches.length) return [];
  translator.setTranslator(matches[0]);
  try {
    return (await translator.translate({ libraryID: false })) as CslItem[];
  } catch (err) {
    ztoolkit.log("safeImport translateFile failed", err);
    return [];
  }
}

async function toPreviewRows(items: CslItem[]): Promise<ImportPreviewRow[]> {
  const candidates = items.map((item) => cslItemToCandidate(item, nextRowId()));
  return buildPreviewRows(candidates);
}

async function parseBibliographyText(raw: string): Promise<ImportPreviewRow[]> {
  rowSeq = 0;
  const items = await translateString(raw);
  return toPreviewRows(items);
}

async function parseBibliographyFile(
  path: string,
): Promise<ImportPreviewRow[]> {
  rowSeq = 0;
  const items = await translateFile(path);
  return toPreviewRows(items);
}
