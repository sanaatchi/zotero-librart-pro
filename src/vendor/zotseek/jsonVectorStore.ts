// @ajan: cursor · @etiket: f9.2.3, zotseek, json-store
// Pure JSON vector catalog helpers (slim F9.2.3 — not full SQLite store).

export type JsonVectorRow = {
  itemId: number;
  itemKey?: string;
  libraryId?: number;
  modelId: string;
  embedding: number[];
  indexedAt: string;
  contentHash: string;
};

export type JsonVectorStoreFile = {
  version: 1;
  modelId: string;
  rows: Record<string, JsonVectorRow>;
};

export {
  emptyJsonVectorStore,
  upsertJsonVectorRow,
  removeJsonVectorRow,
  listJsonVectorRows,
  contentHashForText,
};

function emptyJsonVectorStore(modelId: string): JsonVectorStoreFile {
  return { version: 1, modelId, rows: {} };
}

function upsertJsonVectorRow(
  store: JsonVectorStoreFile,
  row: JsonVectorRow,
): JsonVectorStoreFile {
  return {
    ...store,
    modelId: row.modelId || store.modelId,
    rows: {
      ...store.rows,
      [String(row.itemId)]: row,
    },
  };
}

function removeJsonVectorRow(
  store: JsonVectorStoreFile,
  itemId: number,
): JsonVectorStoreFile {
  const rows = { ...store.rows };
  delete rows[String(itemId)];
  return { ...store, rows };
}

function listJsonVectorRows(
  store: JsonVectorStoreFile,
  options: { modelId?: string; itemIds?: number[] } = {},
): JsonVectorRow[] {
  const want = options.itemIds ? new Set(options.itemIds) : null;
  const out: JsonVectorRow[] = [];
  for (const row of Object.values(store.rows)) {
    if (options.modelId && row.modelId !== options.modelId) continue;
    if (want && !want.has(row.itemId)) continue;
    out.push(row);
  }
  return out;
}

/** Cheap stable hash for change detection (not cryptographic). */
function contentHashForText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
