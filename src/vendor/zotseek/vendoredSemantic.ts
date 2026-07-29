// @ajan: cursor · @etiket: f9.2.3, zotseek, vendored, semantic
// Vendored ZotSeek — assets probe + JSON vector findSimilar (F9.2.3).

import { config } from "../../../package.json";
import { probeVendoredZotSeekAssets } from "./assetProbeRuntime";
import {
  findSimilarInStore,
  getVectorStoreStats,
  indexItemEmbedding,
} from "./vectorStoreRuntime";

export {
  isVendoredZotSeekConfigured,
  isVendoredZotSeekReady,
  vendoredFindSimilar,
  getVendoredAssetStatus,
  indexVendoredItems,
  getVendoredIndexStats,
};

let cachedReady: boolean | null = null;
let cachedReason = "unchecked";

function isVendoredZotSeekConfigured(): boolean {
  return (
    Zotero.Prefs.get(`${config.prefsPrefix}.vendoredZotSeek`, true) !== false
  );
}

async function getVendoredAssetStatus(): Promise<{
  ready: boolean;
  reason: string;
}> {
  if (!isVendoredZotSeekConfigured()) {
    return { ready: false, reason: "pref-off" };
  }
  const presence = await probeVendoredZotSeekAssets();
  cachedReady = presence.ready;
  cachedReason = presence.reason;
  return { ready: presence.ready, reason: presence.reason };
}

async function isVendoredZotSeekReady(): Promise<boolean> {
  if (!isVendoredZotSeekConfigured()) return false;
  if (cachedReady != null) return cachedReady;
  const status = await getVendoredAssetStatus();
  return status.ready;
}

async function vendoredFindSimilar(
  itemId: number,
  options: {
    topK?: number;
    minSimilarity?: number;
    excludeItemIds?: number[];
    candidateItemIds?: number[];
  } = {},
): Promise<Array<{ itemId: number; similarity: number }>> {
  if (!(await isVendoredZotSeekReady())) return [];
  try {
    return await findSimilarInStore(itemId, options);
  } catch (e) {
    ztoolkit.log("[LibRart:ZotSeek] vendoredFindSimilar failed", e);
    return [];
  }
}

async function indexVendoredItems(
  itemIds: number[],
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  if (!(await isVendoredZotSeekReady())) {
    return { ok: 0, failed: itemIds.length };
  }
  for (const id of itemIds) {
    try {
      if (await indexItemEmbedding(id)) ok += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
    await Zotero.Promise.delay(50);
  }
  return { ok, failed };
}

async function getVendoredIndexStats() {
  return getVectorStoreStats();
}
