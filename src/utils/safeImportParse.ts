// @ajan: cursor · @etiket: f2, safe-import, parse
// Logic adapted from scholar-sidekick-zotero (MIT) src/ingest/translate.ts

import { foldTag } from "./tagAnalysis";
import type {
  ImportCandidate,
  ImportPreviewRow,
  ImportWarning,
} from "./safeImportTypes";

export {
  pickYear,
  formatAuthors,
  extractIdentifierLabel,
  cslItemToCandidate,
  buildPreviewRows,
  dedupeKeyForCandidate,
  markBatchDuplicates,
  defaultImportSelection,
  warningLabels,
};

function pickYear(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const m = /\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/.exec(date);
  return m ? Number(m[1]) : undefined;
}

function formatAuthors(
  creators:
    | Array<{ creatorType?: string; firstName?: string; lastName?: string; name?: string }>
    | undefined,
): string {
  if (!Array.isArray(creators)) return "";
  return creators
    .filter((c) => !c.creatorType || c.creatorType === "author")
    .map((c) => {
      if (c.lastName) {
        return [c.firstName, c.lastName].filter(Boolean).join(" ");
      }
      return c.name || "";
    })
    .filter(Boolean)
    .join("; ");
}

function extractIdentifierLabel(item: Record<string, unknown>): string | undefined {
  const doi = typeof item.DOI === "string" ? item.DOI.trim() : "";
  if (doi) return `DOI:${doi}`;
  const isbn = typeof item.ISBN === "string" ? item.ISBN.trim() : "";
  if (isbn) return `ISBN:${isbn}`;
  const issn = typeof item.ISSN === "string" ? item.ISSN.trim() : "";
  if (issn) return `ISSN:${issn}`;
  const extra = typeof item.extra === "string" ? item.extra : "";
  const pmid = /PMID:\s*(\d+)/i.exec(extra);
  if (pmid) return `PMID:${pmid[1]}`;
  return undefined;
}

function cslItemToCandidate(
  item: Record<string, unknown>,
  rowId: string,
): ImportCandidate {
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const container =
    (typeof item.publicationTitle === "string" && item.publicationTitle) ||
    (typeof item.bookTitle === "string" && item.bookTitle) ||
    (typeof item.journalAbbreviation === "string" && item.journalAbbreviation) ||
    undefined;
  void container;
  return {
    rowId,
    itemType: typeof item.itemType === "string" ? item.itemType : "journalArticle",
    title,
    authors: formatAuthors(
      item.creators as
        | Array<{
            creatorType?: string;
            firstName?: string;
            lastName?: string;
            name?: string;
          }>
        | undefined,
    ),
    year: pickYear(typeof item.date === "string" ? item.date : undefined),
    identifier: extractIdentifierLabel(item),
    rawCsl: { ...item },
  };
}

function baseWarnings(candidate: ImportCandidate): ImportWarning[] {
  const warnings: ImportWarning[] = [];
  if (!candidate.title.trim()) warnings.push({ kind: "missing-title" });
  if (!candidate.identifier) warnings.push({ kind: "missing-identifier" });
  return warnings;
}

function buildPreviewRows(candidates: ImportCandidate[]): ImportPreviewRow[] {
  const rows = candidates.map((c) => ({
    ...c,
    warnings: baseWarnings(c),
  }));
  return markBatchDuplicates(rows);
}

function dedupeKeyForCandidate(candidate: ImportCandidate): string {
  if (candidate.identifier) {
    return candidate.identifier.toLowerCase();
  }
  const title = foldTag(candidate.title);
  if (title.length >= 8) return `title:${title}`;
  return `row:${candidate.rowId}`;
}

function markBatchDuplicates(rows: ImportPreviewRow[]): ImportPreviewRow[] {
  const seen = new Map<string, string>();
  return rows.map((row) => {
    const key = dedupeKeyForCandidate(row);
    const other = seen.get(key);
    if (other) {
      return {
        ...row,
        warnings: [
          ...row.warnings,
          { kind: "duplicate-batch", otherRowId: other },
        ],
      };
    }
    seen.set(key, row.rowId);
    return row;
  });
}

function hasBlockingWarning(w: ImportWarning): boolean {
  return (
    w.kind === "missing-title" ||
    w.kind === "duplicate-batch" ||
    w.kind === "duplicate-library"
  );
}

function defaultImportSelection(rows: ImportPreviewRow[]): Set<string> {
  const selected = new Set<string>();
  for (const row of rows) {
    if (!row.warnings.some(hasBlockingWarning)) {
      selected.add(row.rowId);
    }
  }
  return selected;
}

function warningLabels(w: ImportWarning): string {
  switch (w.kind) {
    case "missing-title":
      return "missing-title";
    case "missing-identifier":
      return "missing-identifier";
    case "duplicate-batch":
      return `duplicate-batch:${w.otherRowId}`;
    case "duplicate-library":
      return `duplicate-library:${w.itemKey}`;
  }
}
