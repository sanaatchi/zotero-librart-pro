// @ajan: cursor · @etiket: f5, citation, crossref
// Adapted from zotero-reference (AGPL-3.0) api.ts Crossref reference parsing.

import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";
import { normalizeDoi } from "./doiResolver";
import { getPref } from "./prefs";
import { getReferenceAPI } from "../vendor/zotero-reference";

export { computeCitationSuggestions, isCrossrefCitationEnabled };

function isCrossrefCitationEnabled(): boolean {
  const v = getPref("citation.layers.crossref");
  return v === undefined || v === true;
}

/**
 * Citation suggestions via zotero-reference's Crossref CSL JSON resolver
 * (structured reference DOIs). Only links items already in this library.
 */
async function computeCitationSuggestions(
  nodes: Map<number, GraphNode>,
  options: { maxQueries?: number } = {},
): Promise<GraphEdge[]> {
  if (!isCrossrefCitationEnabled()) return [];
  const maxQueries = options.maxQueries ?? 40;
  const api = getReferenceAPI();

  const doiIndex = new Map<string, number>();
  for (const node of nodes.values()) {
    const item = Zotero.Items.get(node.itemID);
    if (!item || item.itemType !== "journalArticle") continue;
    const doi = normalizeDoi((item.getField("DOI") as string) || "");
    if (doi) doiIndex.set(doi.toLowerCase(), node.itemID);
  }
  if (doiIndex.size < 2) return [];

  const queries = [...doiIndex.entries()].slice(0, maxQueries);
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const [doi, itemID] = queries[i];
    try {
      const info = await api.getDOIInfoByCrossref(doi);
      const refDois = (info?.references || [])
        .map((r) => r.identifiers?.DOI)
        .filter((d): d is string => typeof d === "string" && !!d);
      for (const refDoi of refDois) {
        const targetID = doiIndex.get(refDoi.toLowerCase());
        if (!targetID || targetID === itemID) continue;
        const a = Math.min(itemID, targetID);
        const b = Math.max(itemID, targetID);
        const id = makeEdgeId("citation", a, b, "crossref");
        if (seen.has(id)) continue;
        seen.add(id);

        const sourceNode = nodes.get(a);
        const targetNode = nodes.get(b);
        if (!sourceNode || !targetNode) continue;
        edges.push({
          id,
          source: a,
          target: b,
          layer: "citation",
          state: "suggested",
          confidence: 0.9,
          citationSource: "crossref",
          crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
        });
      }
    } catch (e) {
      ztoolkit.log("Citation suggestion query failed", doi, e);
    }
    if (i % 5 === 4) await Zotero.Promise.delay(0);
  }

  return edges;
}
