// @ajan: cursor · @etiket: f5.2, citegeist, vitest
import { describe, expect, it } from "vitest";
import {
  isOpenCitationsCacheFresh,
  readOpenCitationsCache,
  writeOpenCitationsCache,
  parseOpenCitationsReferences,
} from "../src/utils/openCitationsDataSource";
import { buildOpenCitationsLibraryEdges } from "../src/utils/openCitationsEdgeBuilder";
import {
  buildOpenAlexWorkByDoiUrl,
  formatCitegeistSummaryLines,
  slimCitegeistWork,
} from "../src/utils/citegeistMetrics";

describe("openCitations cache", () => {
  const now = 1_700_000_000_000;

  it("treats fresh entries as hit", () => {
    expect(
      isOpenCitationsCacheFresh({ fetched: now - 1000, cited: ["10.1/b"] }, now, 30),
    ).toBe(true);
    expect(
      isOpenCitationsCacheFresh(
        { fetched: now - 40 * 86_400_000, cited: ["10.1/b"] },
        now,
        30,
      ),
    ).toBe(false);
  });

  it("reads and writes cache entries", () => {
    let cache = writeOpenCitationsCache(
      { refs: {} },
      "https://doi.org/10.1/A",
      ["10.1/b"],
      now,
    );
    expect(readOpenCitationsCache(cache, "10.1/a", now, 30)).toEqual(["10.1/b"]);
    expect(readOpenCitationsCache(cache, "10.1/a", now + 40 * 86_400_000, 30)).toBeNull();
  });
});

describe("openCitations parse + edges (regression)", () => {
  it("still parses multi-DOI cited", () => {
    expect(
      parseOpenCitationsReferences([{ citing: "10.1/a", cited: "10.1/b 10.1/c" }]),
    ).toEqual(["10.1/b", "10.1/c"]);
  });

  it("builds library edges", () => {
    const edges = buildOpenCitationsLibraryEdges(
      new Map([
        ["10.1/a", 1],
        ["10.1/b", 2],
      ]),
      new Map([["10.1/a", ["10.1/b"]]]),
    );
    expect(edges).toEqual([{ sourceItemId: 1, targetItemId: 2 }]);
  });
});

describe("citegeistMetrics", () => {
  it("slims OpenAlex work payload", () => {
    const m = slimCitegeistWork({
      id: "https://openalex.org/W1",
      doi: "https://doi.org/10.1/abc",
      title: "Paper",
      publication_year: 2020,
      cited_by_count: 12,
      referenced_works_count: 3,
    });
    expect(m).toMatchObject({
      openAlexId: "W1",
      doi: "10.1/abc",
      citedByCount: 12,
      referencedWorksCount: 3,
      year: 2020,
    });
  });

  it("formats summary lines with labels", () => {
    const lines = formatCitegeistSummaryLines(
      [
        {
          ok: true,
          metrics: {
            title: "A",
            doi: "10.1/a",
            openAlexId: "W1",
            citedByCount: 2,
            referencedWorksCount: 4,
            year: 2019,
          },
        },
        { ok: false, title: "B", doi: null, reason: "no-doi" },
      ],
      {
        noDoi: "no DOI",
        notFound: "missing",
        error: "error",
        ok: (m) => `${m.title}: ${m.citedByCount} cites`,
      },
    );
    expect(lines[0]).toBe("A: 2 cites");
    expect(lines[1]).toContain("no DOI");
  });

  it("builds OpenAlex DOI lookup URL", () => {
    const url = buildOpenAlexWorkByDoiUrl("10.1000/xyz", "a@b.c");
    expect(url).toContain("api.openalex.org/works?");
    expect(url).toContain("filter=doi");
    expect(url).toContain("mailto=a%40b.c");
  });
});
