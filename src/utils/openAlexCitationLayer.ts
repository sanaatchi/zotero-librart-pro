// @ajan: cursor · @etiket: f5, openalex, citation-layer
// OpenAlex referenced_works → in-library citation edges (ZoteroCitationMaps MIT desen)

import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";
import { getPref } from "./prefs";
import {
  OpenAlexDataSource,
  normalizeOpenAlexDoi,
  OpenAlexWorkSlim,
} from "../vendor/zotero-citation-maps/openAlexDataSource";
import { buildOpenAlexLibraryEdges } from "./openAlexEdgeBuilder";

export { computeOpenAlexCitationSuggestions, isOpenAlexCitationEnabled };

function isOpenAlexCitationEnabled(): boolean {
  const v = getPref("citation.layers.openalex");
  return v === undefined || v === true;
}

function getMailto(): string {
  const v = getPref("openalex.mailto");
  return typeof v === "string" ? v.trim() : "";
}

function getCacheDays(): number {
  const v = getPref("openalex.cacheDays");
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

async function loadDiskCache(): Promise<{
  works: Record<string, { fetched: number; record: OpenAlexWorkSlim }>;
} | null> {
  try {
    const path = PathUtils.join(
      Zotero.DataDirectory.dir,
      "librart-openalex-cache.json",
    );
    if (!(await IOUtils.exists(path))) return null;
    return (await IOUtils.readJSON(path)) as {
      works: Record<string, { fetched: number; record: OpenAlexWorkSlim }>;
    };
  } catch {
    return null;
  }
}

async function saveDiskCache(cache: {
  works: Record<string, { fetched: number; record: OpenAlexWorkSlim }>;
}): Promise<void> {
  const path = PathUtils.join(
    Zotero.DataDirectory.dir,
    "librart-openalex-cache.json",
  );
  await IOUtils.writeJSON(path, cache);
}

async function httpGetJSON(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const req = await Zotero.HTTP.request("GET", url, {
        headers: { Accept: "application/json" },
        timeout: 30000,
      });
      return JSON.parse(req.responseText);
    } catch (e) {
      if (attempt === 1) throw e;
      await Zotero.Promise.delay(1500);
    }
  }
  return null;
}

/**
 * Build in-library citation edges from OpenAlex `referenced_works`.
 * Only links items already present in `nodes` (no discovered externals in F5 MVP).
 */
async function computeOpenAlexCitationSuggestions(
  nodes: Map<number, GraphNode>,
  options: {
    maxQueries?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<GraphEdge[]> {
  if (!isOpenAlexCitationEnabled()) return [];

  const maxQueries = options.maxQueries ?? 80;
  const doiToItem = new Map<string, number>();
  const oaIdToItem = new Map<string, number>();

  for (const node of nodes.values()) {
    const item = Zotero.Items.get(node.itemID);
    if (!item || !item.isRegularItem()) continue;
    const doi = normalizeOpenAlexDoi((item.getField("DOI") as string) || "");
    if (doi) doiToItem.set(doi, node.itemID);
  }
  if (doiToItem.size < 2) return [];

  const dois = [...doiToItem.keys()].slice(0, maxQueries);
  const ds = new OpenAlexDataSource({
    mailto: getMailto(),
    cacheDays: getCacheDays(),
    getJSON: httpGetJSON,
    delay: (ms) => Zotero.Promise.delay(ms),
    loadCache: loadDiskCache,
    saveCache: saveDiskCache,
  });
  await ds.init();

  const byDoi = await ds.fetchWorksByDOI(dois, options.onProgress);
  for (const [doi, work] of byDoi) {
    const itemID = doiToItem.get(doi);
    if (itemID && work.id) oaIdToItem.set(work.id, itemID);
  }

  const pairs = buildOpenAlexLibraryEdges(doiToItem, oaIdToItem, byDoi);
  const edges: GraphEdge[] = [];

  for (const pair of pairs) {
    const a = pair.sourceItemId;
    const b = pair.targetItemId;
    const id = makeEdgeId("citation", a, b, "openalex");
    const sourceNode = nodes.get(a);
    const targetNode = nodes.get(b);
    if (!sourceNode || !targetNode) continue;
    edges.push({
      id,
      source: a,
      target: b,
      layer: "citation",
      state: "suggested",
      confidence: 0.92,
      crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
      citationSource: "openalex",
    });
  }

  return edges;
}
