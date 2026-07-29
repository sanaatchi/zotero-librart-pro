import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";

export { isZotSeekReady, computeSemanticSuggestions, searchByText };

export type SemanticSuggestionResult = {
  available: boolean;
  edges: GraphEdge[];
};

export type SemanticCacheEntry = {
  itemId: number;
  similarity: number;
  title?: string;
};

export type TextHit = {
  itemId: number;
  similarity: number;
  title?: string;
};

type ZotSeekApi = {
  isReady?: () => boolean;
  findSimilar?: (
    itemId: number,
    options?: {
      topK?: number;
      minSimilarity?: number;
      excludeItemIds?: number[];
      libraryId?: number;
    },
  ) => Promise<
    Array<{
      itemId?: number;
      itemKey?: string;
      libraryId?: number;
      similarity: number;
      title?: string;
    }>
  >;
  search?: (
    query: string,
    options?: {
      topK?: number;
      minSimilarity?: number;
      excludeItemIds?: number[];
      libraryId?: number;
    },
  ) => Promise<
    Array<{
      itemId?: number;
      itemKey?: string;
      libraryId?: number;
      similarity: number;
      title?: string;
    }>
  >;
};

function getZotSeekApi(): ZotSeekApi | null {
  // Soft dependency — ZotSeek attaches itself to the Zotero global.
  try {
    const zotseek = (Zotero as any).ZotSeek;
    return zotseek?.api ?? null;
  } catch {
    return null;
  }
}

function isZotSeekReady(): boolean {
  try {
    const api = getZotSeekApi();
    if (!api) return false;
    if (typeof api.isReady === "function") return !!api.isReady();
    return (
      typeof api.findSimilar === "function" || typeof api.search === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Free-text semantic search via ZotSeek (highlight / draft proposal).
 */
async function searchByText(
  query: string,
  options: {
    topK?: number;
    minSimilarity?: number;
    excludeItemIds?: number[];
    libraryId?: number;
    nodeIDSet?: Set<number>;
  } = {},
): Promise<Array<{ itemId: number; similarity: number; title?: string }>> {
  if (!query.trim()) return [];
  const api = getZotSeekApi();
  if (!api?.search) return [];
  try {
    const raw = await api.search(query.trim(), {
      topK: options.topK ?? 5,
      minSimilarity: options.minSimilarity ?? 0.4,
      excludeItemIds: options.excludeItemIds,
      libraryId: options.libraryId,
    });
    const fallbackLibraryID =
      options.libraryId ?? Zotero.Libraries.userLibraryID;
    const nodeIDSet = options.nodeIDSet;
    const hits: Array<{
      itemId: number;
      similarity: number;
      title?: string;
    }> = [];
    const seen = new Set<number>();

    for (const r of raw || []) {
      let itemId: number | null = r.itemId ?? null;
      if (!itemId && r.itemKey) {
        const got = Zotero.Items.getByLibraryAndKey(
          r.libraryId ?? fallbackLibraryID,
          r.itemKey,
        );
        if (got) {
          if (got.isRegularItem()) {
            itemId = got.id;
          } else if (got.parentItemID) {
            const parent = Zotero.Items.get(got.parentItemID);
            if (parent && parent.isRegularItem()) {
              itemId = parent.id;
            }
          }
        }
      }
      if (!itemId || seen.has(itemId)) continue;
      if (nodeIDSet && !nodeIDSet.has(itemId)) continue;
      seen.add(itemId);
      hits.push({
        itemId,
        similarity: r.similarity,
        title: r.title,
      });
    }
    return hits;
  } catch (e) {
    ztoolkit.log("ZotSeek search failed", e);
    return [];
  }
}

function resolveHitItemId(
  hit: { itemId?: number; itemKey?: string; libraryId?: number },
  fallbackLibraryID: number,
  nodeIDSet: Set<number>,
  keyToID: Map<string, number>,
): number | null {
  if (hit.itemId && nodeIDSet.has(hit.itemId)) return hit.itemId;
  if (hit.itemKey) {
    const fromMap = keyToID.get(hit.itemKey);
    if (fromMap && nodeIDSet.has(fromMap)) return fromMap;
    const lib = hit.libraryId ?? fallbackLibraryID;
    const item = Zotero.Items.getByLibraryAndKey(lib, hit.itemKey);
    if (item && item.isRegularItem() && nodeIDSet.has(item.id)) {
      return item.id;
    }
  }
  return null;
}

export type ComputeSemanticOptions = {
  topK?: number;
  minSimilarity?: number;
  /** Max nodes to query — caps cost on large libraries. */
  maxQueries?: number;
  seedItemIDs?: number[];
  cache?: Map<number, SemanticCacheEntry[]>;
  /** Session-dismissed edge ids (layer::a::b::). */
  dismissedIds?: Set<string>;
  /** Skip pairs that already have a confirmed relatedItem link. */
  relatedPairs?: Set<string>;
  onProgress?: (done: number, total: number) => void;
};

function pairKey(a: number, b: number): string {
  return `${Math.min(a, b)}::${Math.max(a, b)}`;
}

/**
 * Approximation: suggest edge(A,B) if B ∈ findSimilar(A) OR A ∈ findSimilar(B)
 * (asymmetric union). No pairwise-similarity primitive exists on ZotSeek.
 */
async function computeSemanticSuggestions(
  nodes: Map<number, GraphNode>,
  options: ComputeSemanticOptions = {},
): Promise<SemanticSuggestionResult> {
  if (!isZotSeekReady()) {
    return { available: false, edges: [] };
  }
  const api = getZotSeekApi();
  if (!api?.findSimilar) {
    return { available: false, edges: [] };
  }

  const {
    topK = 5,
    minSimilarity = 0.45,
    maxQueries = 80,
    seedItemIDs,
    cache,
    dismissedIds,
    relatedPairs,
    onProgress,
  } = options;

  let queryIDs = seedItemIDs?.length
    ? seedItemIDs.filter((id) => nodes.has(id))
    : [...nodes.keys()];

  // Prefer items with more tags as seeds when capping (cheap importance proxy).
  if (queryIDs.length > maxQueries) {
    queryIDs = queryIDs
      .map((id) => ({ id, tagCount: nodes.get(id)?.tagCount ?? 0 }))
      .sort((a, b) => b.tagCount - a.tagCount)
      .slice(0, maxQueries)
      .map((x) => x.id);
  }

  const pairBest = new Map<string, { a: number; b: number; score: number }>();
  const nodeIDSet = new Set(nodes.keys());
  const keyToID = new Map<string, number>();
  let fallbackLibraryID = Zotero.Libraries.userLibraryID;
  for (const node of nodes.values()) {
    keyToID.set(node.key, node.itemID);
    fallbackLibraryID = node.libraryID;
  }

  for (let i = 0; i < queryIDs.length; i++) {
    const itemID = queryIDs[i];
    onProgress?.(i, queryIDs.length);

    let results: SemanticCacheEntry[] | undefined = cache?.get(itemID);
    if (!results) {
      try {
        const raw = await api.findSimilar(itemID, {
          topK,
          minSimilarity,
          excludeItemIds: [itemID],
          libraryId: nodes.get(itemID)?.libraryID,
        });
        results = [];
        for (const r of raw || []) {
          const resolved = resolveHitItemId(
            r,
            fallbackLibraryID,
            nodeIDSet,
            keyToID,
          );
          if (!resolved) continue;
          results.push({
            itemId: resolved,
            similarity: r.similarity,
            title: r.title,
          });
        }
        cache?.set(itemID, results);
      } catch (e) {
        ztoolkit.log("ZotSeek findSimilar failed", itemID, e);
        results = [];
        // Cache empty to avoid hammering a failing item this session.
        cache?.set(itemID, results);
      }
    }

    for (const hit of results) {
      if (!hit.itemId || hit.itemId === itemID) continue;
      if (hit.similarity < minSimilarity) continue;
      if (!nodes.has(hit.itemId)) continue;

      const a = Math.min(itemID, hit.itemId);
      const b = Math.max(itemID, hit.itemId);
      const pk = pairKey(a, b);
      if (relatedPairs?.has(pk)) continue;

      const edgeId = makeEdgeId("semantic", a, b, "");
      if (dismissedIds?.has(edgeId)) continue;

      const prev = pairBest.get(pk);
      if (!prev || hit.similarity > prev.score) {
        pairBest.set(pk, { a, b, score: hit.similarity });
      }
    }

    // Yield to UI between batches.
    if (i % 5 === 4) {
      await Zotero.Promise.delay(0);
    }
  }
  onProgress?.(queryIDs.length, queryIDs.length);

  const edges: GraphEdge[] = [];
  for (const pair of pairBest.values()) {
    const sourceNode = nodes.get(pair.a);
    const targetNode = nodes.get(pair.b);
    if (!sourceNode || !targetNode) continue;
    edges.push({
      id: makeEdgeId("semantic", pair.a, pair.b, ""),
      source: pair.a,
      target: pair.b,
      layer: "semantic",
      state: "suggested",
      confidence: Math.max(0, Math.min(1, pair.score)),
      crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
    });
  }

  return { available: true, edges };
}
