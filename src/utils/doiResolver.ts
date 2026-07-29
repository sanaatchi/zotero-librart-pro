export { resolveByDoi, normalizeDoi };

export type DoiRecord = {
  doi: string;
  title?: string;
  authors?: string[];
  year?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  abstract?: string;
  /** DOIs of this work's own references, when Crossref exposes structured ones. */
  references?: string[];
  source: "crossref" | "semanticscholar" | "arxiv";
};

function normalizeDoi(raw: string): string {
  return (raw || "")
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
}

async function getJson(url: string): Promise<any | null> {
  try {
    const xhr = await Zotero.HTTP.request("GET", url, {
      headers: { Accept: "application/json" },
      timeout: 15000,
    });
    return JSON.parse(xhr.responseText);
  } catch (e) {
    ztoolkit.log("doiResolver: request failed", url, e);
    return null;
  }
}

async function fromCrossref(doi: string): Promise<DoiRecord | null> {
  const data = await getJson(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
  );
  const msg = data?.message;
  if (!msg) return null;
  const authors = Array.isArray(msg.author)
    ? msg.author
        .map((a: any) => [a.given, a.family].filter(Boolean).join(" "))
        .filter(Boolean)
    : undefined;
  const year =
    msg["published-print"]?.["date-parts"]?.[0]?.[0] ??
    msg["published-online"]?.["date-parts"]?.[0]?.[0] ??
    msg.issued?.["date-parts"]?.[0]?.[0];
  const references = Array.isArray(msg.reference)
    ? msg.reference
        .map((r: any) => r?.DOI)
        .filter((d: any): d is string => typeof d === "string" && !!d)
    : undefined;
  return {
    doi,
    title: Array.isArray(msg.title) ? msg.title[0] : msg.title,
    authors,
    year: year ? String(year) : undefined,
    publicationTitle: Array.isArray(msg["container-title"])
      ? msg["container-title"][0]
      : msg["container-title"],
    volume: msg.volume || undefined,
    issue: msg.issue || undefined,
    references: references?.length ? references : undefined,
    source: "crossref",
  };
}

async function fromSemanticScholar(doi: string): Promise<DoiRecord | null> {
  const data = await getJson(
    `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(
      doi,
    )}?fields=title,year,authors,venue,abstract`,
  );
  if (!data?.title) return null;
  return {
    doi,
    title: data.title,
    authors: Array.isArray(data.authors)
      ? data.authors.map((a: any) => a.name).filter(Boolean)
      : undefined,
    year: data.year ? String(data.year) : undefined,
    publicationTitle: data.venue || undefined,
    abstract: data.abstract || undefined,
    source: "semanticscholar",
  };
}

/** arXiv DOIs (10.48550/arXiv.XXXX) — extract the id and query the Atom API. */
async function fromArxiv(doi: string): Promise<DoiRecord | null> {
  const m = doi.match(/arxiv\.(\S+)$/i);
  if (!m) return null;
  const id = m[1];
  try {
    const xhr = await Zotero.HTTP.request(
      "GET",
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
      { timeout: 15000 },
    );
    const doc = new DOMParser().parseFromString(xhr.responseText, "text/xml");
    const entry = doc.querySelector("entry");
    if (!entry) return null;
    const title = entry.querySelector("title")?.textContent?.trim();
    const authors = [...entry.querySelectorAll("author name")]
      .map((n) => n?.textContent?.trim())
      .filter((s): s is string => !!s);
    const published = entry.querySelector("published")?.textContent;
    return {
      doi,
      title,
      authors: authors.length ? authors : undefined,
      year: published ? published.slice(0, 4) : undefined,
      abstract: entry.querySelector("summary")?.textContent?.trim(),
      source: "arxiv",
    };
  } catch (e) {
    ztoolkit.log("doiResolver: arXiv request failed", id, e);
    return null;
  }
}

/**
 * Crossref -> Semantic Scholar -> arXiv, in order. All three are plain
 * unauthenticated REST/XML calls (no API keys), used the same way
 * zotero-reference's api.ts does — reimplemented here, not copied.
 */
async function resolveByDoi(rawDoi: string): Promise<DoiRecord | null> {
  const doi = normalizeDoi(rawDoi);
  if (!doi) return null;
  return (
    (await fromCrossref(doi)) ||
    (await fromSemanticScholar(doi)) ||
    (await fromArxiv(doi))
  );
}
