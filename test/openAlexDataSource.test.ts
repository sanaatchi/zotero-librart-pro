import { describe, expect, it } from "vitest";
import {
  normalizeOpenAlexDoi,
  slimOpenAlexWork,
  OpenAlexDataSource,
} from "../src/vendor/zotero-citation-maps/openAlexDataSource";
import { buildOpenAlexLibraryEdges } from "../src/utils/openAlexEdgeBuilder";

describe("openAlexDataSource", () => {
  it("normalizes DOI forms", () => {
    expect(normalizeOpenAlexDoi("https://doi.org/10.1000/xyz")).toBe(
      "10.1000/xyz",
    );
    expect(normalizeOpenAlexDoi("doi:10.1000/XYZ")).toBe("10.1000/xyz");
    expect(normalizeOpenAlexDoi("")).toBeNull();
  });

  it("slims OpenAlex work payloads", () => {
    const slim = slimOpenAlexWork({
      id: "https://openalex.org/W1",
      doi: "https://doi.org/10.1/abc",
      title: "Paper",
      publication_year: 2020,
      cited_by_count: 3,
      authorships: [{ author: { display_name: "Ada" } }],
      referenced_works: ["https://openalex.org/W2"],
      primary_location: { source: { display_name: "Nature" } },
    });
    expect(slim).toMatchObject({
      id: "W1",
      doi: "10.1/abc",
      title: "Paper",
      year: 2020,
      citedByCount: 3,
      authors: ["Ada"],
      venue: "Nature",
      references: ["W2"],
    });
  });

  it("uses cache before network", async () => {
    let calls = 0;
    const ds = new OpenAlexDataSource({
      cacheDays: 30,
      getJSON: async () => {
        calls += 1;
        return { results: [] };
      },
      delay: async () => undefined,
      loadCache: async () => ({
        works: {
          "doi:10.1/a": {
            fetched: Date.now(),
            record: {
              id: "W1",
              doi: "10.1/a",
              title: "Cached",
              year: 2019,
              citedByCount: 1,
              authors: [],
              venue: null,
              references: [],
            },
          },
        },
      }),
    });
    await ds.init();
    const map = await ds.fetchWorksByDOI(["10.1/a"]);
    expect(map.get("10.1/a")?.title).toBe("Cached");
    expect(calls).toBe(0);
  });
});

describe("buildOpenAlexLibraryEdges", () => {
  it("links library items when OA references resolve", () => {
    const doiToItem = new Map([
      ["10.1/a", 1],
      ["10.1/b", 2],
    ]);
    const oaIdToItem = new Map([
      ["W1", 1],
      ["W2", 2],
    ]);
    const works = new Map([
      [
        "10.1/a",
        {
          id: "W1",
          doi: "10.1/a",
          title: "A",
          year: 2020,
          citedByCount: 0,
          authors: [],
          venue: null,
          references: ["W2", "W9"],
        },
      ],
    ]);
    const edges = buildOpenAlexLibraryEdges(doiToItem, oaIdToItem, works);
    expect(edges).toEqual([{ sourceItemId: 1, targetItemId: 2 }]);
  });
});
