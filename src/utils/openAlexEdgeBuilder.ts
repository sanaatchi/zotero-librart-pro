// @ajan: cursor · @etiket: f5, openalex, edge-builder
import type { OpenAlexWorkSlim } from "../vendor/zotero-citation-maps/openAlexDataSource";

export type OpenAlexLibraryEdge = {
  sourceItemId: number;
  targetItemId: number;
};

/**
 * Pure: given DOI→item and OpenAlex ID→item indexes plus fetched works,
 * emit undirected in-library citation pairs (source cites target via OA refs).
 */
export function buildOpenAlexLibraryEdges(
  doiToItem: Map<string, number>,
  oaIdToItem: Map<string, number>,
  worksByDoi: Map<string, OpenAlexWorkSlim>,
): OpenAlexLibraryEdge[] {
  const seen = new Set<string>();
  const edges: OpenAlexLibraryEdge[] = [];

  for (const [doi, work] of worksByDoi) {
    const sourceID = doiToItem.get(doi);
    if (!sourceID) continue;
    for (const refOaId of work.references || []) {
      const targetID = oaIdToItem.get(refOaId);
      if (!targetID || targetID === sourceID) continue;
      const a = Math.min(sourceID, targetID);
      const b = Math.max(sourceID, targetID);
      const key = `${a}::${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ sourceItemId: a, targetItemId: b });
    }
  }

  return edges;
}
