// @ajan: cursor · @etiket: f5.2, opencitations, edge-builder

export type OpenCitationsLibraryEdge = {
  sourceItemId: number;
  targetItemId: number;
};

/**
 * Pure: DOI→item index + citing DOI → cited DOI list → undirected in-library pairs.
 */
export function buildOpenCitationsLibraryEdges(
  doiToItem: Map<string, number>,
  refsByCitingDoi: Map<string, string[]>,
): OpenCitationsLibraryEdge[] {
  const seen = new Set<string>();
  const edges: OpenCitationsLibraryEdge[] = [];

  for (const [citingDoi, citedDois] of refsByCitingDoi) {
    const sourceID = doiToItem.get(citingDoi);
    if (!sourceID) continue;
    for (const cited of citedDois) {
      const targetID = doiToItem.get(cited);
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
