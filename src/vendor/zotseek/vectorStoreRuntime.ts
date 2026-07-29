// @ajan: cursor · @etiket: f9.2.3, zotseek, vector-runtime, atomic-io, rmw
// Disk-backed JSON vectors + optional EmbeddingPipeline for index/findSimilar.

import { EmbeddingPipeline } from "./core/embedding-pipeline";
import { DEFAULT_MODEL_ID, getActiveModelId } from "./core/model-registry";
import { probeVendoredZotSeekAssets } from "./assetProbeRuntime";
import {
  JsonVectorStoreFile,
  contentHashForText,
  emptyJsonVectorStore,
  listJsonVectorRows,
} from "./jsonVectorStore";
import { createVectorMutator } from "./vectorStoreMutate";
import { topKSimilar } from "./vectorMath";

export {
  indexItemEmbedding,
  findSimilarInStore,
  getVectorStoreStats,
  extractItemEmbedText,
};

const STORE_FILE = "librart-zotseek-vectors.json";

let pipeline: EmbeddingPipeline | null = null;
let pipelineInitFailed = false;
let memoryStore: JsonVectorStoreFile | null = null;

const mutator = createVectorMutator({
  getMemory: () => memoryStore,
  setMemory: (s) => {
    memoryStore = s;
  },
  load: loadStore,
  persist: persistStoreUnlocked,
});

function storePath(): string {
  return PathUtils.join(Zotero.DataDirectory.dir, STORE_FILE);
}

function storeTmpPath(): string {
  return `${storePath()}.tmp`;
}

async function loadStore(): Promise<JsonVectorStoreFile> {
  if (memoryStore) return memoryStore;
  const modelId = getActiveModelId() || DEFAULT_MODEL_ID;
  try {
    const path = storePath();
    if (await IOUtils.exists(path)) {
      const raw = (await IOUtils.readJSON(path)) as JsonVectorStoreFile;
      if (raw?.version === 1 && raw.rows) {
        memoryStore = raw;
        return raw;
      }
    }
  } catch (e) {
    ztoolkit.log("[LibRart:ZotSeek] vector store load failed", e);
  }
  memoryStore = emptyJsonVectorStore(modelId);
  return memoryStore;
}

/** Physical write — only called from the mutation queue. */
async function persistStoreUnlocked(store: JsonVectorStoreFile): Promise<void> {
  const path = storePath();
  const tmp = storeTmpPath();
  try {
    await IOUtils.writeJSON(tmp, store);
    await IOUtils.move(tmp, path);
  } catch (e) {
    try {
      if (await IOUtils.exists(tmp)) await IOUtils.remove(tmp);
    } catch {
      /* ignore cleanup */
    }
    ztoolkit.log("[LibRart:ZotSeek] vector store save failed", e);
    throw e;
  }
}

function extractItemEmbedText(item: Zotero.Item): string {
  const title = String(item.getField("title") || "").trim();
  const abs = String(item.getField("abstractNote") || "").trim();
  const combined = abs ? `${title}\n${abs}` : title;
  return combined.slice(0, 8000);
}

async function getPipeline(): Promise<EmbeddingPipeline | null> {
  const assets = await probeVendoredZotSeekAssets();
  if (!assets.ready) return null;
  if (pipelineInitFailed) return null;
  if (pipeline) return pipeline;
  try {
    pipeline = new EmbeddingPipeline();
    await pipeline.init();
    return pipeline;
  } catch (e) {
    pipelineInitFailed = true;
    pipeline = null;
    ztoolkit.log("[LibRart:ZotSeek] EmbeddingPipeline init failed", e);
    return null;
  }
}

async function indexItemEmbedding(itemId: number): Promise<boolean> {
  const item = Zotero.Items.get(itemId);
  if (!item || !item.isRegularItem()) return false;
  const text = extractItemEmbedText(item);
  if (!text) return false;

  const pipe = await getPipeline();
  if (!pipe) return false;

  const modelId = getActiveModelId() || DEFAULT_MODEL_ID;
  const hash = contentHashForText(text);

  const peek = memoryStore?.rows[String(itemId)];
  if (peek && peek.contentHash === hash && peek.modelId === modelId) {
    return true;
  }

  // Embed outside the queue; only load→upsert→disk is serialized.
  // Generation drops stale embeds if a newer index for the same item started.
  const generation = mutator.beginGeneration(itemId);
  const result = await pipe.embedDocument(text);
  const committed = await mutator.commitRow(
    {
      itemId,
      itemKey: item.key,
      libraryId: item.libraryID,
      modelId: result.modelId || modelId,
      embedding: result.embedding,
      indexedAt: new Date().toISOString(),
      contentHash: hash,
    },
    generation,
  );
  return committed.applied || committed.reason === "unchanged";
}

async function findSimilarInStore(
  itemId: number,
  options: {
    topK?: number;
    minSimilarity?: number;
    excludeItemIds?: number[];
    candidateItemIds?: number[];
  } = {},
): Promise<Array<{ itemId: number; similarity: number }>> {
  const store = await loadStore();
  const modelId = getActiveModelId() || DEFAULT_MODEL_ID;
  let queryRow = store.rows[String(itemId)];

  if (!queryRow || queryRow.modelId !== modelId) {
    const indexed = await indexItemEmbedding(itemId);
    if (!indexed) return [];
    queryRow = (await loadStore()).rows[String(itemId)];
    if (!queryRow) return [];
  }

  const catalog = listJsonVectorRows(store, {
    modelId,
    itemIds: options.candidateItemIds,
  }).map((r) => ({ itemId: r.itemId, embedding: r.embedding }));

  const exclude = new Set(options.excludeItemIds ?? []);
  exclude.add(itemId);

  return topKSimilar(queryRow.embedding, catalog, {
    topK: options.topK,
    minSimilarity: options.minSimilarity,
    excludeItemIds: [...exclude],
  });
}

async function getVectorStoreStats(): Promise<{
  count: number;
  modelId: string;
  path: string;
}> {
  const store = await loadStore();
  return {
    count: Object.keys(store.rows).length,
    modelId: store.modelId || getActiveModelId() || DEFAULT_MODEL_ID,
    path: storePath(),
  };
}
