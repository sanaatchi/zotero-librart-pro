// @ajan: cursor · @etiket: f5.2, opencitations, vitest
import { describe, expect, it } from "vitest";
import {
  buildOpenCitationsReferencesUrl,
  normalizeOpenCitationsDoi,
  parseOpenCitationsReferences,
} from "../src/utils/openCitationsDataSource";
import { buildOpenCitationsLibraryEdges } from "../src/utils/openCitationsEdgeBuilder";

describe("openCitationsDataSource", () => {
  it("normalizes DOI forms", () => {
    expect(normalizeOpenCitationsDoi("https://doi.org/10.1000/xyz")).toBe(
      "10.1000/xyz",
    );
    expect(normalizeOpenCitationsDoi("doi:10.1000/XYZ")).toBe("10.1000/xyz");
    expect(normalizeOpenCitationsDoi("")).toBeNull();
  });

  it("builds references URL", () => {
    expect(buildOpenCitationsReferencesUrl("10.1186/1756-8722-6-59")).toBe(
      "https://api.opencitations.net/index/v1/references/10.1186%2F1756-8722-6-59",
    );
  });

  it("parses reference rows and multi-DOI cited fields", () => {
    const cited = parseOpenCitationsReferences([
      { citing: "10.1/a", cited: "10.1/b" },
      { citing: "10.1/a", cited: "" },
      {
        citing: "10.1/a",
        cited: "10.1/c 10.1/d",
      },
      { citing: "10.1/a", cited: "https://doi.org/10.1/B" },
    ]);
    expect(cited).toEqual(["10.1/b", "10.1/c", "10.1/d"]);
  });
});

describe("buildOpenCitationsLibraryEdges", () => {
  it("links library items when cited DOIs resolve", () => {
    const doiToItem = new Map([
      ["10.1/a", 1],
      ["10.1/b", 2],
      ["10.1/c", 3],
    ]);
    const refs = new Map([["10.1/a", ["10.1/b", "10.9/x", "10.1/c"]]]);
    const edges = buildOpenCitationsLibraryEdges(doiToItem, refs);
    expect(edges).toEqual([
      { sourceItemId: 1, targetItemId: 2 },
      { sourceItemId: 1, targetItemId: 3 },
    ]);
  });
});
