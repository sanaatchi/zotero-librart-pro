// @ajan: cursor · @etiket: f9, semantic, kutuphane, parse, kp-align, loopback
// Pure helpers for Kutuphane semantic bridge (8756) — no Zotero globals.
import {
  MAX_LIBRARY_PDFS,
  normalizeKpToken,
} from "./kpToken";

export { MAX_LIBRARY_PDFS, normalizeKpToken };

export type SemanticStatusPayload = {
  ready: boolean;
  backend?: string;
  model?: string;
  chunkCount?: number;
  error?: string | null;
  connectionGraph?: KutuphaneConnectionGraphSummary | null;
};

export type KutuphaneConnectionGraphSummary = {
  ok: boolean;
  generatedAt?: string;
  nodeCount?: number;
  edgeCount?: number;
  edgesByLayer?: Record<string, number>;
  path?: string;
};

export type SemanticSearchHit = {
  kpId: string;
  category: string;
  text: string;
  sourceFile: string;
  pageNum: number;
  score: number;
};

export type HttpTargetPolicy = {
  /** When true (default), only loopback / localhost hosts are allowed. */
  loopbackOnly?: boolean;
  /** Extra hostnames allowed when loopbackOnly is true. */
  allowHosts?: string[];
};

export type SemanticIndexEntry = {
  itemId: number;
  citationKey: string | null;
  /** Zotero item key (8-char) — maps chunk ids `z:KEY`. */
  zoteroKey?: string | null;
};

/** Kutuphane `cache/zotero_connection_graph.json` / GET /connection-graph */
export type KutuphaneConnectionGraphEdgeJson = {
  id: string;
  source: string;
  target: string;
  layer: string;
  state: string;
  confidence: number;
  via?: Record<string, unknown>;
};

export type KutuphaneConnectionGraphPayload = {
  ok?: boolean;
  version?: number;
  generatedAt?: string;
  nodeCount?: number;
  edgeCount?: number;
  edgesByLayer?: Record<string, number>;
  nodes?: Array<{
    zoteroKey?: string;
    itemID?: number;
    title?: string;
  }>;
  edges?: KutuphaneConnectionGraphEdgeJson[];
  error?: string;
};

export {
  normalizeSemanticBaseUrl,
  isAllowedHttpTarget,
  parseStatusPayload,
  parseSearchPayload,
  parseConnectionGraphPayload,
  buildKpIndexFromEntries,
  mapHitsToItemIds,
  normalizeHitDocId,
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function isAllowedHttpTarget(
  url: string,
  policy: HttpTargetPolicy = {},
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  const loopbackOnly = policy.loopbackOnly !== false;
  if (!loopbackOnly) return true;
  const host = parsed.hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return true;
  const extra = (policy.allowHosts || []).map((h) => h.toLowerCase());
  return extra.includes(host);
}

function normalizeSemanticBaseUrl(
  raw: unknown,
  policy: HttpTargetPolicy = {},
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (!isAllowedHttpTarget(trimmed, policy)) return null;
  return trimmed;
}

function parseStatusPayload(json: unknown): SemanticStatusPayload {
  if (!json || typeof json !== "object") {
    return { ready: false, error: "invalid status payload" };
  }
  const o = json as Record<string, unknown>;
  const chunkCount =
    typeof o.chunkCount === "number" && Number.isFinite(o.chunkCount)
      ? o.chunkCount
      : undefined;
  let connectionGraph: KutuphaneConnectionGraphSummary | null | undefined;
  const cg = o.connectionGraph;
  if (cg && typeof cg === "object") {
    const c = cg as Record<string, unknown>;
    connectionGraph = {
      ok: !!c.ok,
      generatedAt:
        typeof c.generatedAt === "string" ? c.generatedAt : undefined,
      nodeCount:
        typeof c.nodeCount === "number" && Number.isFinite(c.nodeCount)
          ? c.nodeCount
          : undefined,
      edgeCount:
        typeof c.edgeCount === "number" && Number.isFinite(c.edgeCount)
          ? c.edgeCount
          : undefined,
      edgesByLayer:
        c.edgesByLayer && typeof c.edgesByLayer === "object"
          ? (c.edgesByLayer as Record<string, number>)
          : undefined,
      path: typeof c.path === "string" ? c.path : undefined,
    };
  }
  return {
    ready: !!o.ready,
    backend: typeof o.backend === "string" ? o.backend : undefined,
    model: typeof o.model === "string" ? o.model : undefined,
    chunkCount,
    connectionGraph,
    error:
      typeof o.error === "string"
        ? o.error
        : o.error === null
          ? null
          : undefined,
  };
}

function parseSearchPayload(json: unknown): SemanticSearchHit[] {
  if (!json || typeof json !== "object") return [];
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const out: SemanticSearchHit[] = [];
  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const kpId = String(r.kpId ?? "").trim();
    if (!kpId) continue;
    const score =
      typeof r.score === "number" && Number.isFinite(r.score) ? r.score : 0;
    const pageNum =
      typeof r.pageNum === "number" && Number.isFinite(r.pageNum)
        ? r.pageNum
        : 0;
    out.push({
      kpId,
      category: String(r.category ?? ""),
      text: String(r.text ?? ""),
      sourceFile: String(r.sourceFile ?? ""),
      pageNum,
      score,
    });
  }
  return out;
}

function parseConnectionGraphPayload(
  json: unknown,
): KutuphaneConnectionGraphPayload | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === false) return null;
  const edgesRaw = o.edges;
  if (!Array.isArray(edgesRaw)) return null;
  const edges: KutuphaneConnectionGraphEdgeJson[] = [];
  for (const row of edgesRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const source = String(r.source ?? "").trim();
    const target = String(r.target ?? "").trim();
    const layer = String(r.layer ?? "").trim();
    if (!source || !target || !layer) continue;
    const confidence =
      typeof r.confidence === "number" && Number.isFinite(r.confidence)
        ? r.confidence
        : 1;
    edges.push({
      id: String(r.id ?? ""),
      source,
      target,
      layer,
      state: String(r.state ?? "confirmed"),
      confidence,
      via:
        r.via && typeof r.via === "object"
          ? (r.via as Record<string, unknown>)
          : undefined,
    });
  }
  return {
    ok: o.ok !== false,
    version:
      typeof o.version === "number" && Number.isFinite(o.version)
        ? o.version
        : undefined,
    generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : undefined,
    nodeCount:
      typeof o.nodeCount === "number" && Number.isFinite(o.nodeCount)
        ? o.nodeCount
        : undefined,
    edgeCount:
      typeof o.edgeCount === "number" && Number.isFinite(o.edgeCount)
        ? o.edgeCount
        : undefined,
    edgesByLayer:
      o.edgesByLayer && typeof o.edgesByLayer === "object"
        ? (o.edgesByLayer as Record<string, number>)
        : undefined,
    edges,
    error: typeof o.error === "string" ? o.error : undefined,
  };
}

/** Normalize chunk doc id for index lookup: KP… / z:KEY (upper). */
function normalizeHitDocId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const kp = normalizeKpToken(s);
  if (kp) return kp;
  const zm = /^z:([A-Z0-9]+)$/i.exec(s);
  if (zm) return `Z:${zm[1].toUpperCase()}`;
  // zpath:… — no stable item map without path index
  return null;
}

function buildKpIndexFromEntries(
  entries: SemanticIndexEntry[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (typeof e.itemId !== "number" || !Number.isFinite(e.itemId)) continue;
    const cite = (e.citationKey || "").trim();
    const kp = normalizeKpToken(cite);
    if (kp) {
      map.set(kp, e.itemId);
    }
    const zk = (e.zoteroKey || "").trim();
    if (zk) {
      map.set(`Z:${zk.toUpperCase()}`, e.itemId);
    }
  }
  return map;
}

function mapHitsToItemIds(
  hits: SemanticSearchHit[],
  kpIndex: Map<string, number>,
  options: {
    excludeItemIds?: number[];
    minScore?: number;
  } = {},
): Array<{ itemId: number; similarity: number; title?: string }> {
  const excluded = new Set(options.excludeItemIds || []);
  const minScore =
    typeof options.minScore === "number" && Number.isFinite(options.minScore)
      ? options.minScore
      : -Infinity;
  const seen = new Set<number>();
  const out: Array<{ itemId: number; similarity: number; title?: string }> = [];
  for (const hit of hits) {
    if (hit.score < minScore) continue;
    const docId = normalizeHitDocId(hit.kpId);
    if (!docId) continue;
    const itemId = kpIndex.get(docId);
    if (!itemId || seen.has(itemId) || excluded.has(itemId)) continue;
    seen.add(itemId);
    out.push({ itemId, similarity: hit.score, title: hit.text });
  }
  return out;
}
