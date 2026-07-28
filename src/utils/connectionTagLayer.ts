import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";

export { computeTagLayerEdges };

export type FoldedTagIndex = Map<
  string,
  { display: string; itemIDs: Set<number> }
>;

/**
 * Tag co-occurrence layer, adapted from zotero-style's getGraphByItemArrLink:
 * group items by shared folded tag, use a density threshold so popular tags
 * do not emit full cliques (hairballs).
 *
 * - Below threshold: emit direct pairwise edges (viaTags populated).
 * - At/above threshold: skip — no synthetic tag hub nodes in v1.
 *
 * Hard caps keep large libraries readable: pairwise only for small tags,
 * then keep the strongest pairs (most shared tags) up to MAX_TAG_EDGES.
 */
const MIN_DENSE_SKIP = 4;
/** Never build a full clique for tags shared by this many items or more. */
const MAX_PAIRWISE_TAG_SIZE = 5;
/** Soft cap after merge — prefer multi-tag bridges over weak single-tag links. */
const MAX_TAG_EDGES = 1800;

function computeTagLayerEdges(
  nodes: Map<number, GraphNode>,
  foldedTagIndex: FoldedTagIndex,
): GraphEdge[] {
  const multiSizes = [...foldedTagIndex.values()]
    .map((e) => e.itemIDs.size)
    .filter((n) => n > 1)
    .sort((a, b) => a - b);

  let limit = Infinity;
  if (multiSizes.length) {
    // 75th percentile: 90th left too many mid-size cliques in large libs.
    const pct = 0.75;
    const idx = Math.min(
      multiSizes.length - 1,
      Math.max(0, Math.floor(multiSizes.length * pct)),
    );
    limit = multiSizes[idx];
  }
  const denseThreshold = Math.min(
    Math.max(limit, MIN_DENSE_SKIP),
    MAX_PAIRWISE_TAG_SIZE,
  );

  // Merge multiple shared tags onto one edge per item pair.
  const pairMap = new Map<
    string,
    { a: number; b: number; tags: string[] }
  >();

  for (const entry of foldedTagIndex.values()) {
    const ids = [...entry.itemIDs].filter((id) => nodes.has(id));
    if (ids.length < 2) continue;
    // Dense / popular tags: skip pairwise clique (hairball prevention).
    if (ids.length >= denseThreshold) continue;

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = Math.min(ids[i], ids[j]);
        const b = Math.max(ids[i], ids[j]);
        const key = `${a}::${b}`;
        let pair = pairMap.get(key);
        if (!pair) {
          pair = { a, b, tags: [] };
          pairMap.set(key, pair);
        }
        if (!pair.tags.includes(entry.display)) {
          pair.tags.push(entry.display);
        }
      }
    }
  }

  const ranked = [...pairMap.values()].sort((p, q) => {
    if (q.tags.length !== p.tags.length) return q.tags.length - p.tags.length;
    return p.a - q.a || p.b - q.b;
  });
  const kept = ranked.slice(0, MAX_TAG_EDGES);

  const edges: GraphEdge[] = [];
  for (const pair of kept) {
    const sourceNode = nodes.get(pair.a);
    const targetNode = nodes.get(pair.b);
    if (!sourceNode || !targetNode) continue;

    const via = pair.tags.slice().sort().join("+");
    edges.push({
      id: makeEdgeId("tag", pair.a, pair.b, via),
      source: pair.a,
      target: pair.b,
      layer: "tag",
      state: "confirmed",
      confidence: 1,
      viaTags: pair.tags,
      crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
    });
  }
  return edges;
}
