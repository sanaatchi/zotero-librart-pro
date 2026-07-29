// @ajan: cursor · @etiket: f5.2, opencitations, parse, cache
// Pure OpenCitations Index API helpers — no Zotero globals.

export type OpenCitationsRefRow = {
  citing: string;
  cited: string;
};

export type OpenCitationsCacheEntry = {
  fetched: number;
  cited: string[];
};

export type OpenCitationsCacheFile = {
  refs: Record<string, OpenCitationsCacheEntry>;
};

export {
  normalizeOpenCitationsDoi,
  parseOpenCitationsReferences,
  buildOpenCitationsReferencesUrl,
  isOpenCitationsCacheFresh,
  readOpenCitationsCache,
  writeOpenCitationsCache,
};

const API_BASE = "https://api.opencitations.net/index/v1";
const MS_PER_DAY = 86_400_000;

function normalizeOpenCitationsDoi(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  s = s.replace(/^doi:\s*/i, "");
  s = s.trim();
  if (!s.startsWith("10.")) return null;
  return s;
}

/**
 * Parse Index API /references/{doi} JSON. `cited` may contain multiple
 * space-separated DOIs; empty cited values are skipped.
 */
function parseOpenCitationsReferences(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of payload) {
    if (!row || typeof row !== "object") continue;
    const citedRaw = String((row as OpenCitationsRefRow).cited ?? "").trim();
    if (!citedRaw) continue;
    for (const part of citedRaw.split(/\s+/)) {
      const doi = normalizeOpenCitationsDoi(part);
      if (!doi || seen.has(doi)) continue;
      seen.add(doi);
      out.push(doi);
    }
  }
  return out;
}

function buildOpenCitationsReferencesUrl(doi: string): string {
  const normalized = normalizeOpenCitationsDoi(doi);
  if (!normalized) throw new Error("invalid DOI");
  return `${API_BASE}/references/${encodeURIComponent(normalized)}`;
}

function isOpenCitationsCacheFresh(
  entry: OpenCitationsCacheEntry | undefined,
  nowMs: number,
  cacheDays: number,
): boolean {
  if (!entry || !Number.isFinite(entry.fetched)) return false;
  const days = cacheDays > 0 ? cacheDays : 30;
  return nowMs - entry.fetched <= days * MS_PER_DAY;
}

function readOpenCitationsCache(
  cache: OpenCitationsCacheFile | null | undefined,
  doi: string,
  nowMs: number,
  cacheDays: number,
): string[] | null {
  const key = normalizeOpenCitationsDoi(doi);
  if (!key || !cache?.refs) return null;
  const entry = cache.refs[key];
  if (!isOpenCitationsCacheFresh(entry, nowMs, cacheDays)) return null;
  return [...entry.cited];
}

function writeOpenCitationsCache(
  cache: OpenCitationsCacheFile,
  doi: string,
  cited: string[],
  fetchedMs: number,
): OpenCitationsCacheFile {
  const key = normalizeOpenCitationsDoi(doi);
  if (!key) return cache;
  return {
    refs: {
      ...cache.refs,
      [key]: { fetched: fetchedMs, cited: [...cited] },
    },
  };
}
