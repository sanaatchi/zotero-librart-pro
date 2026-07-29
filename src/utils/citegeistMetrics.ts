// @ajan: cursor · @etiket: citegeist, metrics, pure
// Clean-room Citegeist-style summary helpers (OpenAlex metrics) — no GPL copy.

export type CitegeistWorkMetrics = {
  title: string;
  doi: string | null;
  openAlexId: string | null;
  citedByCount: number;
  referencedWorksCount: number;
  year: number | null;
};

export type CitegeistLookupResult =
  | { ok: true; metrics: CitegeistWorkMetrics }
  | {
      ok: false;
      title: string;
      doi: string | null;
      reason: "no-doi" | "not-found" | "error";
    };

export type CitegeistSummaryLabels = {
  noDoi: string;
  notFound: string;
  error: string;
  ok: (m: CitegeistWorkMetrics) => string;
};

export {
  slimCitegeistWork,
  formatCitegeistSummaryLine,
  formatCitegeistSummaryLines,
  buildOpenAlexWorkByDoiUrl,
};

function slimCitegeistWork(work: unknown): CitegeistWorkMetrics | null {
  if (!work || typeof work !== "object") return null;
  const w = work as Record<string, unknown>;
  const idRaw = String(w.id || "").replace("https://openalex.org/", "");
  const title = String(w.title || w.display_name || "").trim() || "(untitled)";
  let doi: string | null = null;
  if (typeof w.doi === "string" && w.doi.trim()) {
    doi = w.doi
      .trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .replace(/^doi:/i, "")
      .toLowerCase();
  }
  const cited =
    typeof w.cited_by_count === "number" && Number.isFinite(w.cited_by_count)
      ? w.cited_by_count
      : 0;
  const refsCount =
    typeof w.referenced_works_count === "number" &&
    Number.isFinite(w.referenced_works_count)
      ? w.referenced_works_count
      : Array.isArray(w.referenced_works)
        ? w.referenced_works.length
        : 0;
  const year =
    typeof w.publication_year === "number" && Number.isFinite(w.publication_year)
      ? w.publication_year
      : null;
  return {
    title,
    doi,
    openAlexId: idRaw || null,
    citedByCount: cited,
    referencedWorksCount: refsCount,
    year,
  };
}

function formatCitegeistSummaryLine(
  result: CitegeistLookupResult,
  labels: CitegeistSummaryLabels,
): string {
  if (!result.ok) {
    const head = result.title || result.doi || "—";
    if (result.reason === "no-doi") return `${head}: ${labels.noDoi}`;
    if (result.reason === "not-found") return `${head}: ${labels.notFound}`;
    return `${head}: ${labels.error}`;
  }
  return labels.ok(result.metrics);
}

function formatCitegeistSummaryLines(
  results: CitegeistLookupResult[],
  labels: CitegeistSummaryLabels,
): string[] {
  return results.map((r) => formatCitegeistSummaryLine(r, labels));
}

function buildOpenAlexWorkByDoiUrl(doi: string, mailto = ""): string {
  const normalized = doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .toLowerCase();
  const filter = `doi:${normalized}`;
  const params = new URLSearchParams({
    filter,
    select:
      "id,doi,title,display_name,publication_year,cited_by_count,referenced_works_count,referenced_works",
    per_page: "1",
  });
  if (mailto.trim()) params.set("mailto", mailto.trim());
  return `https://api.openalex.org/works?${params.toString()}`;
}
