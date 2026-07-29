import { GraphEdge, GraphNode, getNodeDisciplineKey } from "./connectionGraph";

export { annotateBridgeScores, getBridgeNeighborDisciplines };

/**
 * Bridge score = number of distinct discipline keys reached via
 * confirmed cross-discipline edges. Used for node sizing (Faz 2).
 */
function annotateBridgeScores(
  nodes: Map<number, GraphNode>,
  edges: GraphEdge[],
): void {
  const neighborDisc = new Map<number, Set<string>>();
  for (const id of nodes.keys()) {
    neighborDisc.set(id, new Set());
  }

  for (const e of edges) {
    if (e.state !== "confirmed") continue;
    if (!e.crossDiscipline) continue;
    const a = nodes.get(e.source);
    const b = nodes.get(e.target);
    if (!a || !b) continue;
    neighborDisc.get(e.source)?.add(getNodeDisciplineKey(b));
    neighborDisc.get(e.target)?.add(getNodeDisciplineKey(a));
  }

  for (const [id, set] of neighborDisc) {
    const node = nodes.get(id);
    if (!node) continue;
    (node as GraphNode & { bridgeScore?: number }).bridgeScore = set.size;
  }
}

function getBridgeNeighborDisciplines(
  nodeID: number,
  nodes: Map<number, GraphNode>,
  edges: GraphEdge[],
): string[] {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.state !== "confirmed" || !e.crossDiscipline) continue;
    if (e.source === nodeID) {
      const n = nodes.get(e.target);
      if (n) out.add(getNodeDisciplineKey(n));
    } else if (e.target === nodeID) {
      const n = nodes.get(e.source);
      if (n) out.add(getNodeDisciplineKey(n));
    }
  }
  return [...out];
}
