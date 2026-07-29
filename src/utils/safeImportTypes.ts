// @ajan: cursor · @etiket: f2, safe-import, types

export type ImportWarning =
  | { kind: "missing-title" }
  | { kind: "missing-identifier" }
  | { kind: "duplicate-batch"; otherRowId: string }
  | { kind: "duplicate-library"; itemKey: string };

export type ImportCandidate = {
  rowId: string;
  itemType: string;
  title: string;
  authors: string;
  year?: number;
  identifier?: string;
  rawCsl: Record<string, unknown>;
};

export type ImportPreviewRow = ImportCandidate & {
  warnings: ImportWarning[];
};
