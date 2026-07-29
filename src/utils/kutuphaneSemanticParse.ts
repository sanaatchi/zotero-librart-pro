// @ajan: cursor · @etiket: f9, semantic, kutuphane, parse
// Pure helpers for Kutuphane semantic bridge (8756) — no Zotero globals.

export type SemanticStatusPayload = {
  ready: boolean;
  backend?: string;
  model?: string;
  chunkCount?: number;
  error?: string | null;
};

export type SemanticSearchHit = {
  kpId: string;
  category: string;
  text: string;
  sourceFile: string;
  pageNum: number;
  score: number;
};

export {
  normalizeSemanticBaseUrl,
  parseStatusPayload,
  parseSearchPayload,
  buildKpIndexFromEntries,
  mapHitsToItemIds,
};

function normalizeSemanticBaseUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
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
  return {
    ready: !!o.ready,
    backend: typeof o.backend === "string" ? o.backend : undefined,
    model: typeof o.model === "string" ? o.model : undefined,
    chunkCount,
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

function buildKpIndexFromEntries(
  entries: Array<{ itemId: number; citationKey: string | null }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    const key = (e.citationKey || "").trim();
    if (!key || !/^KP\d+$/i.test(key)) continue;
    if (typeof e.itemId !== "number" || !Number.isFinite(e.itemId)) continue;
    map.set(key.toUpperCase(), e.itemId);
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
    const itemId = kpIndex.get(hit.kpId.toUpperCase());
    if (!itemId || seen.has(itemId) || excluded.has(itemId)) continue;
    seen.add(itemId);
    out.push({ itemId, similarity: hit.score, title: hit.text });
  }
  return out;
}
