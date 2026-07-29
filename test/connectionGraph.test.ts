// @ajan: cursor · @etiket: f0, vitest, connection-graph
import { describe, expect, it } from "vitest";
import {
  UNSORTED_DISCIPLINE_ID,
  UNSORTED_DISCIPLINE_LABEL,
  getNodeDisciplineKey,
  isCrossDiscipline,
  makeEdgeId,
  type GraphNode,
} from "../src/utils/connectionGraph";

function node(partial: Partial<GraphNode> & Pick<GraphNode, "itemID">): GraphNode {
  return {
    key: "ABC",
    libraryID: 1,
    title: "t",
    creatorSummary: "",
    itemType: "journalArticle",
    disciplineIDs: [],
    disciplineLabels: [],
    tagCount: 0,
    ...partial,
  };
}

describe("makeEdgeId", () => {
  it("is symmetric for source/target order", () => {
    expect(makeEdgeId("tag", 5, 9)).toBe(makeEdgeId("tag", 9, 5));
  });

  it("includes layer and via suffix", () => {
    expect(makeEdgeId("manual", 1, 2, "note-7")).toBe("manual::1::2::note-7");
  });
});

describe("isCrossDiscipline", () => {
  it("uses disciplineProfile.primary when both nodes have one", () => {
    const a = node({
      itemID: 1,
      disciplineProfile: { primary: "Sanat", scores: {}, source: "tags" },
    });
    const b = node({
      itemID: 2,
      disciplineProfile: { primary: "Felsefe", scores: {}, source: "tags" },
    });
    expect(isCrossDiscipline(a, b)).toBe(true);
  });

  it("never treats unsorted-only nodes as bridges", () => {
    const unsorted = node({
      itemID: 1,
      disciplineIDs: [UNSORTED_DISCIPLINE_ID],
      disciplineLabels: [UNSORTED_DISCIPLINE_LABEL],
    });
    const art = node({ itemID: 2, disciplineIDs: [10], disciplineLabels: ["Sanat"] });
    expect(isCrossDiscipline(unsorted, art)).toBe(false);
  });
});

describe("getNodeDisciplineKey", () => {
  it("prefers disciplineProfile.primary", () => {
    const n = node({
      itemID: 1,
      disciplineIDs: [99],
      disciplineProfile: { primary: "Tarih", scores: {}, source: "collection" },
    });
    expect(getNodeDisciplineKey(n)).toBe("Tarih");
  });
});
