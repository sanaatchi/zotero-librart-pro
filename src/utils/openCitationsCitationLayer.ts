// @ajan: cursor · @etiket: f5.2, opencitations, citation-layer, cache
// OpenCitations Index /references → in-library citation edges (opt-in + disk cache).

import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";
import { getPref } from "./prefs";
import {
  OpenCitationsCacheFile,
  buildOpenCitationsReferencesUrl,
  normalizeOpenCitationsDoi,
  parseOpenCitationsReferences,
  readOpenCitationsCache,
  writeOpenCitationsCache,
} from "./openCitationsDataSource";
import { buildOpenCitationsLibraryEdges } from "./openCitationsEdgeBuilder";

export {
  computeOpenCitationsCitationSuggestions,
  isOpenCitationsCitationEnabled,
};

function isOpenCitationsCitationEnabled(): boolean {
  return getPref("citation.layers.openCitations") === true;
}

function getCacheDays(): number {
  const v = getPref("openalex.cacheDays");
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

async function loadDiskCache(): Promise<OpenCitationsCacheFile> {
  try {
    const path = PathUtils.join(
      Zotero.DataDirectory.dir,
      "librart-opencitations-cache.json",
    );
    if (!(await IOUtils.exists(path))) return { refs: {} };
    const raw = (await IOUtils.readJSON(path)) as OpenCitationsCacheFile;
    if (raw && typeof raw === "object" && raw.refs) return raw;
  } catch {
    /* soft */
  }
  return { refs: {} };
}

async function saveDiskCache(cache: OpenCitationsCacheFile): Promise<void> {
  try {
    const path = PathUtils.join(
      Zotero.DataDirectory.dir,
      "librart-opencitations-cache.json",
    );
    await IOUtils.writeJSON(path, cache);
  } catch {
    /* soft */
  }
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
 * Build in-library citation edges from OpenCitations outgoing references.
 * Only links items already present in `nodes`.
 */
async function computeOpenCitationsCitationSuggestions(
  nodes: Map<number, GraphNode>,
  options: {
    maxQueries?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<GraphEdge[]> {
  if (!isOpenCitationsCitationEnabled()) return [];

  const maxQueries = options.maxQueries ?? 60;
  const cacheDays = getCacheDays();
  const now = Date.now();
  let cache = await loadDiskCache();
  let cacheDirty = false;

  const doiToItem = new Map<string, number>();

  for (const node of nodes.values()) {
    const item = Zotero.Items.get(node.itemID);
    if (!item || !item.isRegularItem()) continue;
    const doi = normalizeOpenCitationsDoi(
      (item.getField("DOI") as string) || "",
    );
    if (doi) doiToItem.set(doi, node.itemID);
  }
  if (doiToItem.size < 2) return [];

  const dois = [...doiToItem.keys()].slice(0, maxQueries);
  const refsByCitingDoi = new Map<string, string[]>();
  const total = dois.length;

  for (let i = 0; i < dois.length; i++) {
    const doi = dois[i];
    options.onProgress?.(i, total);

    const cached = readOpenCitationsCache(cache, doi, now, cacheDays);
    if (cached) {
      if (cached.length) refsByCitingDoi.set(doi, cached);
      continue;
    }

    try {
      const url = buildOpenCitationsReferencesUrl(doi);
      const payload = await httpGetJSON(url);
      const cited = parseOpenCitationsReferences(payload);
      cache = writeOpenCitationsCache(cache, doi, cited, Date.now());
      cacheDirty = true;
      if (cited.length) refsByCitingDoi.set(doi, cited);
    } catch (e) {
      ztoolkit.log(`OpenCitations fetch failed for ${doi}`, e);
    }
    if (i + 1 < dois.length) {
      await Zotero.Promise.delay(200);
    }
  }
  options.onProgress?.(total, total);

  if (cacheDirty) {
    await saveDiskCache(cache);
  }

  const pairs = buildOpenCitationsLibraryEdges(doiToItem, refsByCitingDoi);
  const edges: GraphEdge[] = [];

  for (const pair of pairs) {
    const a = pair.sourceItemId;
    const b = pair.targetItemId;
    const sourceNode = nodes.get(a);
    const targetNode = nodes.get(b);
    if (!sourceNode || !targetNode) continue;
    edges.push({
      id: makeEdgeId("citation", a, b, "opencitations"),
      source: a,
      target: b,
      layer: "citation",
      state: "suggested",
      confidence: 0.9,
      crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
      citationSource: "opencitations",
    });
  }

  return edges;
}
