// Adapted from zotero-reference (AGPL-3.0) — DOI/metadata resolution facade.

import { getReferenceAPI, getReferenceUtils } from "../vendor/zotero-reference";

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
  source: "crossref" | "semanticscholar" | "arxiv" | "unpaywall";
};

function normalizeDoi(raw: string): string {
  const utils = getReferenceUtils();
  const text = (raw || "").trim();
  const id = utils.getIdentifiers(text.replace(/\s+/g, ""));
  if (id.DOI) return id.DOI;
  return text
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
}

function itemInfoToDoiRecord(
  info: ItemInfo,
  source: DoiRecord["source"],
): DoiRecord {
  const doi = info.identifiers?.DOI || normalizeDoi(info.url || "");
  const references = (info.references || [])
    .map((r) => r.identifiers?.DOI)
    .filter((d): d is string => typeof d === "string" && !!d);
  return {
    doi,
    title: info.title,
    authors: info.authors,
    year: info.year ? String(info.year) : undefined,
    publicationTitle: info.primaryVenue,
    abstract: info.abstract,
    references: references.length ? references : undefined,
    source,
  };
}

/**
 * Crossref CSL JSON → Semantic Scholar → arXiv → Unpaywall (zotero-reference api.ts order).
 */
async function resolveByDoi(rawDoi: string): Promise<DoiRecord | null> {
  const utils = getReferenceUtils();
  const api = getReferenceAPI();
  const doi = normalizeDoi(rawDoi);
  if (!doi) return null;

  const crossref = await api.getDOIInfoByCrossref(doi);
  if (crossref?.title) {
    return itemInfoToDoiRecord(crossref, "crossref");
  }

  const s2 = await api.getDOIInfoBySemanticscholar(doi);
  if (s2?.title) {
    return itemInfoToDoiRecord(s2, "semanticscholar");
  }

  const arxivId = utils.matchArXiv(doi);
  if (arxivId) {
    const arxiv = await api.getArXivInfo(String(arxivId));
    if (arxiv?.title) {
      const rec = itemInfoToDoiRecord(arxiv, "arxiv");
      rec.doi = doi;
      return rec;
    }
  }

  const base = await api.getDOIBaseInfo(doi);
  if (base?.title) {
    return itemInfoToDoiRecord(base as ItemInfo, "unpaywall");
  }

  return null;
}
