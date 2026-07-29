// @ajan: cursor · @etiket: f5, openalex, vendor
// Adapted from ZoteroCitationMaps dataSource.js (MIT) — schulzedaniel

export type OpenAlexWorkSlim = {
  id: string;
  doi: string | null;
  title: string;
  year: number | null;
  citedByCount: number;
  authors: string[];
  venue: string | null;
  references: string[];
};

export type OpenAlexCacheEntry = {
  fetched: number;
  record: OpenAlexWorkSlim;
};

export type OpenAlexCacheFile = {
  works: Record<string, OpenAlexCacheEntry>;
};

export type OpenAlexDataSourceOptions = {
  mailto?: string;
  cacheDays?: number;
  getJSON: (url: string) => Promise<unknown>;
  delay?: (ms: number) => Promise<void>;
  loadCache?: () => Promise<OpenAlexCacheFile | null>;
  saveCache?: (cache: OpenAlexCacheFile) => Promise<void>;
};

const API_BASE = "https://api.openalex.org";
const BATCH_SIZE = 50;
const FIELDS = [
  "id",
  "doi",
  "title",
  "display_name",
  "publication_year",
  "cited_by_count",
  "authorships",
  "referenced_works",
  "primary_location",
].join(",");

export { OpenAlexDataSource, normalizeOpenAlexDoi, slimOpenAlexWork };

function normalizeOpenAlexDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  const normalized = doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .toLowerCase();
  return normalized || null;
}

function slimOpenAlexWork(work: any): OpenAlexWorkSlim {
  const authors = (work.authorships || [])
    .slice(0, 6)
    .map((a: any) => a.author && a.author.display_name)
    .filter(Boolean);
  return {
    id: String(work.id || "").replace("https://openalex.org/", ""),
    doi: normalizeOpenAlexDoi(work.doi),
    title: work.title || work.display_name || "(untitled)",
    year: work.publication_year || null,
    citedByCount: work.cited_by_count || 0,
    authors,
    venue:
      (work.primary_location &&
        work.primary_location.source &&
        work.primary_location.source.display_name) ||
      null,
    references: (work.referenced_works || []).map((r: string) =>
      String(r).replace("https://openalex.org/", ""),
    ),
  };
}

class OpenAlexDataSource {
  private cache: OpenAlexCacheFile = { works: {} };
  private readonly mailto: string;
  private readonly cacheDays: number;
  private readonly getJSON: (url: string) => Promise<unknown>;
  private readonly delay: (ms: number) => Promise<void>;
  private readonly loadCache?: () => Promise<OpenAlexCacheFile | null>;
  private readonly saveCacheFn?: (cache: OpenAlexCacheFile) => Promise<void>;

  constructor(options: OpenAlexDataSourceOptions) {
    this.mailto = options.mailto || "";
    this.cacheDays = options.cacheDays ?? 30;
    this.getJSON = options.getJSON;
    this.delay =
      options.delay ||
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.loadCache = options.loadCache;
    this.saveCacheFn = options.saveCache;
  }

  async init(): Promise<void> {
    if (!this.loadCache) return;
    try {
      const loaded = await this.loadCache();
      if (loaded && typeof loaded === "object" && loaded.works) {
        this.cache = loaded;
      }
    } catch {
      this.cache = { works: {} };
    }
  }

  async saveCache(): Promise<void> {
    if (!this.saveCacheFn) return;
    try {
      await this.saveCacheFn(this.cache);
    } catch {
      // ignore persist errors
    }
  }

  async clearCache(): Promise<void> {
    this.cache = { works: {} };
    await this.saveCache();
  }

  async fetchWorksByDOI(
    dois: string[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<Map<string, OpenAlexWorkSlim>> {
    const result = new Map<string, OpenAlexWorkSlim>();
    const missing: string[] = [];

    for (const doi of dois) {
      const cached = this.cacheGet(`doi:${doi}`);
      if (cached) result.set(doi, cached);
      else missing.push(doi);
    }

    let done = dois.length - missing.length;
    onProgress?.(done, dois.length);

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const filter = "doi:" + batch.join("|");
      const url =
        `${API_BASE}/works?filter=${encodeURIComponent(filter)}` +
        `&per-page=${BATCH_SIZE}&select=${FIELDS}${this.mailtoParam()}`;
      try {
        const json = (await this.getJSON(url)) as { results?: any[] };
        for (const work of json.results || []) {
          const slim = slimOpenAlexWork(work);
          if (!slim.doi) continue;
          result.set(slim.doi, slim);
          this.cachePut(`doi:${slim.doi}`, slim);
          this.cachePut(`oa:${slim.id}`, slim);
        }
      } catch {
        // unresolved DOIs stay missing
      }
      done += batch.length;
      onProgress?.(Math.min(done, dois.length), dois.length);
      await this.delay(120);
    }

    await this.saveCache();
    return result;
  }

  private mailtoParam(): string {
    return this.mailto
      ? `&mailto=${encodeURIComponent(this.mailto)}`
      : "";
  }

  private cacheGet(key: string): OpenAlexWorkSlim | null {
    const entry = this.cache.works[key];
    if (!entry) return null;
    const ageMs = Date.now() - entry.fetched;
    if (ageMs > this.cacheDays * 24 * 3600 * 1000) return null;
    return entry.record;
  }

  private cachePut(key: string, record: OpenAlexWorkSlim): void {
    this.cache.works[key] = { fetched: Date.now(), record };
  }
}
