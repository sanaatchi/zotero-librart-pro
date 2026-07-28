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
 * group items by shared folded tag, use the 90th-percentile of multi-item
 * tag sizes as a density threshold.
 *
 * - Below threshold: emit direct pairwise edges (viaTags populated).
 * - At/above threshold: skip the full clique to avoid hairballs. We do not
 *   create synthetic tag hub nodes — GraphNode is always a Zotero item.
 *
 * MIN_DENSE_SKIP: if the 90th percentile is very low (e.g. most tags shared
 * by only 2 items), treating that as "dense" would skip every edge and empty
 * the graph. Never skip cliques smaller than this floor.
 */
const MIN_DENSE_SKIP = 8;

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
    const pct = 0.9;
    const idx = Math.min(
      multiSizes.length - 1,
      Math.max(0, Math.floor(multiSizes.length * pct)),
    );
    limit = multiSizes[idx];
  }
  const denseThreshold = Math.max(limit, MIN_DENSE_SKIP);

  // Merge multiple shared tags onto one edge per item pair.
  const pairMap = new Map<
    string,
    { a: number; b: number; tags: string[] }
  >();

  for (const entry of foldedTagIndex.values()) {
    const ids = [...entry.itemIDs].filter((id) => nodes.has(id));
    if (ids.length < 2) continue;
    // Dense tags: skip pairwise clique (hairball prevention).
    if (ids.length >= denseThreshold) {
      continue;
    }

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

  const edges: GraphEdge[] = [];
  for (const pair of pairMap.values()) {
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
