import {
  ConnectionGraph,
  getNodeDisciplineKey,
} from "./connectionGraph";

export type BlindSpotPair = {
  a: string;
  b: string;
  sizeA: number;
  sizeB: number;
  bridges: number;
  expectedMin: number;
};

export { findBlindSpots };

/**
 * Find discipline pairs that are large but barely cross-linked
 * (Faz 4 — kör nokta).
 */
function findBlindSpots(
  graph: ConnectionGraph,
  options: { minCluster?: number; maxResults?: number } = {},
): BlindSpotPair[] {
  const minCluster = options.minCluster ?? 8;
  const maxResults = options.maxResults ?? 3;

  const clusters = new Map<string, number[]>();
  for (const node of graph.nodes.values()) {
    const key = getNodeDisciplineKey(node);
    if (!key || key === "-1" || key === "Unsorted") continue;
    let list = clusters.get(key);
    if (!list) {
      list = [];
      clusters.set(key, list);
    }
    list.push(node.itemID);
  }

  const keys = [...clusters.keys()].filter(
    (k) => (clusters.get(k)?.length || 0) >= minCluster,
  );
  if (keys.length < 2) return [];

  const bridgeCount = new Map<string, number>();
  const pairKey = (a: string, b: string) =>
    a < b ? `${a}||${b}` : `${b}||${a}`;

  for (const e of graph.edges) {
    if (e.state !== "confirmed" || !e.crossDiscipline) continue;
    const na = graph.nodes.get(e.source);
    const nb = graph.nodes.get(e.target);
    if (!na || !nb) continue;
    const ka = getNodeDisciplineKey(na);
    const kb = getNodeDisciplineKey(nb);
    if (ka === kb) continue;
    if (!clusters.has(ka) || !clusters.has(kb)) continue;
    const pk = pairKey(ka, kb);
    bridgeCount.set(pk, (bridgeCount.get(pk) || 0) + 1);
  }

  const spots: BlindSpotPair[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      const sizeA = clusters.get(a)!.length;
      const sizeB = clusters.get(b)!.length;
      const bridges = bridgeCount.get(pairKey(a, b)) || 0;
      // Heuristic: expect at least ~2% of possible cross pairs, floored.
      const expectedMin = Math.max(
        2,
        Math.floor(Math.sqrt(sizeA * sizeB) * 0.08),
      );
      if (bridges < expectedMin) {
        spots.push({ a, b, sizeA, sizeB, bridges, expectedMin });
      }
    }
  }

  return spots
    .sort(
      (p, q) =>
        q.sizeA * q.sizeB - q.bridges * 50 - (p.sizeA * p.sizeB - p.bridges * 50),
    )
    .slice(0, maxResults);
}
