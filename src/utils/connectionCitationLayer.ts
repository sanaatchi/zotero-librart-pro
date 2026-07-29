import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";
import { resolveByDoi, normalizeDoi } from "./doiResolver";

export { computeCitationSuggestions };

/**
 * Reimplements Zotero-Citation-Graph's idea (not its code — no license to
 * copy) with what we already have: DOI resolution (doiResolver.ts) plus
 * Crossref's own structured reference list. Only matches DOIs that are
 * already present on another item in THIS library — no external "have you
 * seen this new paper" discovery, that's a different, bigger feature.
 * Always "suggested" — never auto-promoted, consistent with the semantic
 * layer's confirm-before-persist design.
 */
async function computeCitationSuggestions(
  nodes: Map<number, GraphNode>,
  options: { maxQueries?: number } = {},
): Promise<GraphEdge[]> {
  const maxQueries = options.maxQueries ?? 40;

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
      const record = await resolveByDoi(doi);
      for (const refDoi of record?.references || []) {
        const targetID = doiIndex.get(refDoi.toLowerCase());
        if (!targetID || targetID === itemID) continue;
        const a = Math.min(itemID, targetID);
        const b = Math.max(itemID, targetID);
        const id = makeEdgeId("citation", a, b, "");
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
