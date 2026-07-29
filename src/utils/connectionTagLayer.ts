// Adapted from zotero-style (AGPL-3.0) graphView.ts tag layer + zotero-reference tag co-occurrence.

import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";
import {
  getItemTagValues,
  getTagCooccurrencePairs,
} from "../vendor/zotero-style/tagGraph";

export { computeTagLayerEdges };

const MAX_TAG_EDGES = 1800;

/**
 * Tag co-occurrence layer using zotero-style's getGraphByItemArrLink algorithm
 * (ported in vendor/zotero-style/tagGraph.ts).
 */
function computeTagLayerEdges(
  items: Zotero.Item[],
  nodes: Map<number, GraphNode>,
): GraphEdge[] {
  const regular = items.filter((i) => nodes.has(i.id));
  const pairs = getTagCooccurrencePairs(regular, getItemTagValues, 0.9);

  const ranked = pairs
    .filter((p) => nodes.has(p.a) && nodes.has(p.b))
    .sort((p, q) => {
      if (q.sharedTags.length !== p.sharedTags.length) {
        return q.sharedTags.length - p.sharedTags.length;
      }
      return p.a - q.a || p.b - q.b;
    })
    .slice(0, MAX_TAG_EDGES);

  const edges: GraphEdge[] = [];
  for (const pair of ranked) {
    const sourceNode = nodes.get(pair.a);
    const targetNode = nodes.get(pair.b);
    if (!sourceNode || !targetNode) continue;
    const via = pair.sharedTags.slice().sort().join("+");
    edges.push({
      id: makeEdgeId("tag", pair.a, pair.b, via),
      source: pair.a,
      target: pair.b,
      layer: "tag",
      state: "confirmed",
      confidence: 1,
      viaTags: pair.sharedTags,
      crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
    });
  }
  return edges;
}
