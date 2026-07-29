import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";
import {
  isKutuphaneSemanticConfigured,
  isKutuphaneSemanticReady,
  searchKutuphaneSemantic,
  buildKpIndex,
} from "./kutuphaneSemanticBridge";

export {
  isZotSeekReady,
  isZotSeekAvailable,
  isSemanticLayerReady,
  computeSemanticSuggestions,
  searchByText,
};

/**
 * True if EITHER backend can be used — Kutuphane's GPU-accelerated,
 * multilingual qwen3-embedding:8b (stronger, preferred when configured and
 * live) or ZotSeek (CPU-only, English-centric, but zero-setup). Used by the
 * UI to decide whether to show the "Anlamsal öneri" layer at all.
 */
async function isSemanticLayerReady(): Promise<boolean> {
  if (isKutuphaneSemanticConfigured() && (await isKutuphaneSemanticReady())) {
    return true;
  }
  return isZotSeekReady();
}

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
      libraryKey?: string;
      itemPk?: number;
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

/** Plugin API present (search may cold-start the embedding pipeline). */
function isZotSeekAvailable(): boolean {
  try {
    const api = getZotSeekApi();
    if (!api) return false;
    return (
      typeof api.search === "function" || typeof api.findSimilar === "function"
    );
  } catch {
    return false;
  }
}

/**
 * True when ZotSeek can be used. Do NOT hard-require api.isReady() —
 * search()/findSimilar() auto-init the embedding pipeline on first call.
 */
function isZotSeekReady(): boolean {
  return isZotSeekAvailable();
}

function libraryIdFromZotSeekHit(
  hit: { libraryId?: number; libraryKey?: string },
  fallback: number,
): number {
  if (typeof hit.libraryId === "number" && hit.libraryId > 0) {
    return hit.libraryId;
  }
  const key = hit.libraryKey;
  if (key === "user") return Zotero.Libraries.userLibraryID;
  const m = key?.match(/^group:(\d+)$/);
  if (m) {
    const gid = Number(m[1]);
    // Prefer matching Zotero group library if present.
    for (const lib of Zotero.Libraries.getAll()) {
      if ((lib as any).groupID === gid || lib.libraryID === gid) {
        return lib.libraryID;
      }
    }
    return gid;
  }
  return fallback;
}

/**
 * Free-text search against Kutuphane's chunk index, mapped back to Zotero
 * items via each hit's kpId -> Citation Key. Hits with no KP-linked item in
 * this library (Kutuphane content not yet cross-referenced) are dropped —
 * this is the documented scope limit of the bridge, not a bug.
 */
async function searchTextViaKutuphane(
  query: string,
  options: {
    topK?: number;
    minSimilarity?: number;
    excludeItemIds?: number[];
    libraryId?: number;
    nodeIDSet?: Set<number>;
    allowOutsideGraph?: boolean;
  },
): Promise<Array<{ itemId: number; similarity: number; title?: string }>> {
  const hits = await searchKutuphaneSemantic(query, {
    topK: options.topK,
    minSimilarity: options.minSimilarity,
  });
  if (!hits.length) return [];

  const libraryID = options.libraryId ?? Zotero.Libraries.userLibraryID;
  let candidateIDs: Set<number>;
  if (options.nodeIDSet && !options.allowOutsideGraph) {
    candidateIDs = options.nodeIDSet;
  } else {
    const allItems = await Zotero.Items.getAll(libraryID);
    candidateIDs = new Set(allItems.map((i) => i.id));
  }
  const kpIndex = buildKpIndex(candidateIDs);
  const excluded = new Set(options.excludeItemIds || []);

  const seen = new Set<number>();
  const out: Array<{ itemId: number; similarity: number; title?: string }> =
    [];
  for (const hit of hits) {
    const itemID = kpIndex.get(hit.kpId.toUpperCase());
    if (!itemID || seen.has(itemID) || excluded.has(itemID)) continue;
    seen.add(itemID);
    out.push({ itemId: itemID, similarity: hit.score, title: hit.text });
  }
  return out;
}

/**
 * Free-text semantic search — Kutuphane bridge preferred (searchByText's
 * caller checks isKutuphaneSemanticReady first), ZotSeek as fallback.
 */
async function searchByText(
  query: string,
  options: {
    topK?: number;
    minSimilarity?: number;
    excludeItemIds?: number[];
    libraryId?: number;
    nodeIDSet?: Set<number>;
    /** Soften node filter: keep hits even if outside current graph. */
    allowOutsideGraph?: boolean;
  } = {},
): Promise<Array<{ itemId: number; similarity: number; title?: string }>> {
  const cleaned = query.trim().replace(/\s+/g, " ");
  if (!cleaned) return [];
  // Long pasted paragraphs: embed the head — better recall, less noise.
  const q = cleaned.length > 900 ? cleaned.slice(0, 900) : cleaned;

  if (isKutuphaneSemanticConfigured() && (await isKutuphaneSemanticReady())) {
    const kutuphaneHits = await searchTextViaKutuphane(q, options);
    if (kutuphaneHits.length) return kutuphaneHits;
    // Empty result: fall through to ZotSeek rather than reporting "no match"
    // when Kutuphane simply has no coverage for this query.
  }

  const api = getZotSeekApi();
  if (!api?.search) {
    ztoolkit.log("ZotSeek search() missing on api");
    return [];
  }
  try {
    const raw = await api.search(q, {
      topK: options.topK ?? 5,
      minSimilarity: options.minSimilarity ?? 0.28,
      excludeItemIds: options.excludeItemIds,
      libraryId: options.libraryId,
    });
    const fallbackLibraryID =
      options.libraryId ?? Zotero.Libraries.userLibraryID;
    const nodeIDSet = options.nodeIDSet;
    const allowOutside = options.allowOutsideGraph ?? false;
    const hits: Array<{
      itemId: number;
      similarity: number;
      title?: string;
    }> = [];
    const seen = new Set<number>();

    for (const r of raw || []) {
      // itemPk is ZotSeek-internal — never treat as Zotero id.
      // itemId:-1 is a cache sentinel — treat as missing.
      let itemId: number | null =
        typeof r.itemId === "number" && r.itemId > 0 ? r.itemId : null;
      if (!itemId && r.itemKey) {
        const libId = libraryIdFromZotSeekHit(r, fallbackLibraryID);
        const got = Zotero.Items.getByLibraryAndKey(libId, r.itemKey);
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
      if (nodeIDSet && !nodeIDSet.has(itemId) && !allowOutside) continue;
      seen.add(itemId);
      hits.push({
        itemId,
        similarity: r.similarity,
        title: r.title,
      });
    }

    // Retry softer: in-graph filter dropped everything but API had hits.
    if (!hits.length && nodeIDSet && !allowOutside && (raw || []).length) {
      return searchByText(query, { ...options, allowOutsideGraph: true });
    }

    return hits;
  } catch (e) {
    ztoolkit.log("ZotSeek search failed", e);
    throw e;
  }
}

function resolveHitItemId(
  hit: {
    itemId?: number;
    itemKey?: string;
    libraryId?: number;
    libraryKey?: string;
  },
  fallbackLibraryID: number,
  nodeIDSet: Set<number>,
  keyToID: Map<string, number>,
): number | null {
  if (hit.itemId && hit.itemId > 0 && nodeIDSet.has(hit.itemId)) {
    return hit.itemId;
  }
  if (hit.itemKey) {
    const fromMap = keyToID.get(hit.itemKey);
    if (fromMap && nodeIDSet.has(fromMap)) return fromMap;
    const lib = libraryIdFromZotSeekHit(hit, fallbackLibraryID);
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
 * Kutuphane path: each node's title is used as the query against the
 * chunk index (no per-item "find similar" primitive there either — same
 * asymmetric-union approximation as the ZotSeek path). Only meaningful for
 * nodes that already have a KP-linked counterpart in Kutuphane; nodes
 * without one simply never appear as a target (documented scope limit).
 */
async function computeSemanticSuggestionsViaKutuphane(
  nodes: Map<number, GraphNode>,
  options: ComputeSemanticOptions,
): Promise<SemanticSuggestionResult> {
  const {
    topK = 5,
    minSimilarity = 0.5,
    maxQueries = 80,
    seedItemIDs,
    dismissedIds,
    relatedPairs,
    onProgress,
  } = options;

  const kpIndex = buildKpIndex(nodes.keys());
  if (kpIndex.size < 2) {
    // Nothing in this graph is KP-linked — Kutuphane has no coverage here.
    return { available: true, edges: [] };
  }

  let queryIDs = (seedItemIDs?.length ? seedItemIDs : [...nodes.keys()])
    .filter((id) => nodes.has(id));
  if (queryIDs.length > maxQueries) {
    queryIDs = queryIDs
      .map((id) => ({ id, tagCount: nodes.get(id)?.tagCount ?? 0 }))
      .sort((a, b) => b.tagCount - a.tagCount)
      .slice(0, maxQueries)
      .map((x) => x.id);
  }

  const pairBest = new Map<string, { a: number; b: number; score: number }>();

  for (let i = 0; i < queryIDs.length; i++) {
    const itemID = queryIDs[i];
    onProgress?.(i, queryIDs.length);
    const node = nodes.get(itemID);
    if (!node?.title) continue;

    try {
      const hits = await searchKutuphaneSemantic(node.title, {
        topK,
        minSimilarity,
      });
      for (const hit of hits) {
        const hitItemID = kpIndex.get(hit.kpId.toUpperCase());
        if (!hitItemID || hitItemID === itemID) continue;
        if (hit.score < minSimilarity) continue;

        const a = Math.min(itemID, hitItemID);
        const b = Math.max(itemID, hitItemID);
        const pk = pairKey(a, b);
        if (relatedPairs?.has(pk)) continue;
        const edgeId = makeEdgeId("semantic", a, b, "");
        if (dismissedIds?.has(edgeId)) continue;

        const prev = pairBest.get(pk);
        if (!prev || hit.score > prev.score) {
          pairBest.set(pk, { a, b, score: hit.score });
        }
      }
    } catch (e) {
      ztoolkit.log("Kutuphane semantic query failed", itemID, e);
    }
    if (i % 5 === 4) await Zotero.Promise.delay(0);
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

/**
 * Approximation: suggest edge(A,B) if B ∈ findSimilar(A) OR A ∈ findSimilar(B)
 * (asymmetric union). No pairwise-similarity primitive exists on ZotSeek.
 */
async function computeSemanticSuggestions(
  nodes: Map<number, GraphNode>,
  options: ComputeSemanticOptions = {},
): Promise<SemanticSuggestionResult> {
  if (isKutuphaneSemanticConfigured() && (await isKutuphaneSemanticReady())) {
    return computeSemanticSuggestionsViaKutuphane(nodes, options);
  }

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
