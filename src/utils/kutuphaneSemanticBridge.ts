import { getPref } from "./prefs";
import { getCitationKeyFromExtra } from "./citationKey";

export {
  isKutuphaneSemanticConfigured,
  isKutuphaneSemanticReady,
  searchKutuphaneSemantic,
  buildKpIndex,
};

export type KutuphaneHit = {
  kpId: string;
  category: string;
  text: string;
  sourceFile: string;
  pageNum: number;
  score: number;
};

function baseUrl(): string | null {
  const url = String(getPref("kutuphaneSemanticUrl") || "").trim();
  return url ? url.replace(/\/+$/, "") : null;
}

function isKutuphaneSemanticConfigured(): boolean {
  return !!baseUrl();
}

/** Live readiness check — Ollama reachable + chunks indexed, per /status. */
async function isKutuphaneSemanticReady(): Promise<boolean> {
  const url = baseUrl();
  if (!url) return false;
  try {
    const xhr = await Zotero.HTTP.request("GET", `${url}/status`, {
      timeout: 3000,
    });
    const data = JSON.parse(xhr.responseText);
    return !!data?.ready;
  } catch (e) {
    ztoolkit.log("Kutuphane semantic status check failed", e);
    return false;
  }
}

async function searchKutuphaneSemantic(
  query: string,
  options: { topK?: number; minSimilarity?: number } = {},
): Promise<KutuphaneHit[]> {
  const url = baseUrl();
  if (!url) return [];
  const clean = query.trim();
  if (!clean) return [];
  try {
    const xhr = await Zotero.HTTP.request("POST", `${url}/search`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: clean,
        topK: options.topK ?? 8,
        minSimilarity: options.minSimilarity ?? 0.5,
      }),
      timeout: 20000,
    });
    const data = JSON.parse(xhr.responseText);
    return Array.isArray(data?.results) ? data.results : [];
  } catch (e) {
    ztoolkit.log("Kutuphane semantic search failed", e);
    return [];
  }
}

/**
 * Build a "KPxxxxxx" -> itemID map from a set of items' Citation Key
 * (citationKey.ts's Extra-field convention — the same KP reuse wired in
 * localBookDb.ts's OpenLibrary bridge). Fast, in-memory, no search calls.
 * Callers resolve each search hit's kpId against this map; hits with no
 * match (Kutuphane content not yet linked to a Zotero item) are dropped.
 */
function buildKpIndex(itemIDs: Iterable<number>): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of itemIDs) {
    const item = Zotero.Items.get(id);
    if (!item) continue;
    const key = getCitationKeyFromExtra(item);
    if (key && /^KP\d+$/i.test(key)) {
      map.set(key.toUpperCase(), id);
    }
  }
  return map;
}
