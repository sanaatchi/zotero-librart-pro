import { describe, expect, it } from "vitest";
import {
  buildReadingActivityIndex,
  filterEdgesForMapView,
  findUnreadHubs,
  itemMatchesReadingFilter,
  itemReadSince,
} from "../src/utils/readingFlowMapFilter";
import type { GraphEdge } from "../src/utils/connectionGraph";

describe("readingFlowMapFilter", () => {
  const index = buildReadingActivityIndex([1, 2, 3], (id) => {
    if (id === 1) return { lastReadAt: Date.now() - 86400000, status: "reading" };
    if (id === 2) return { lastReadAt: null, status: "to-read" };
    return { lastReadAt: Date.now() - 40 * 86400000, status: "read" };
  });

  it("detects recent reads", () => {
    const since = Date.now() - 7 * 86400000;
    expect(itemReadSince(index, 1, since)).toBe(true);
    expect(itemReadSince(index, 2, since)).toBe(false);
  });

  it("filters unread nodes", () => {
    expect(itemMatchesReadingFilter(index, 2, "unread")).toBe(true);
    expect(itemMatchesReadingFilter(index, 1, "unread")).toBe(false);
    expect(itemMatchesReadingFilter(index, 1, "reading")).toBe(true);
    expect(itemMatchesReadingFilter(index, 3, "read")).toBe(true);
  });

  it("keeps edges when an endpoint was read recently", () => {
    const edges: GraphEdge[] = [
      {
        id: "e1",
        source: 1,
        target: 2,
        layer: "note",
        state: "confirmed",
        confidence: 1,
        crossDiscipline: false,
      },
    ];
    const filtered = filterEdgesForMapView(edges, 30, index, "all");
    expect(filtered).toHaveLength(1);
  });

  it("finds unread hubs by degree", () => {
    const nodes = new Map([
      [2, { title: "Hub paper" }],
      [3, { title: "Read paper" }],
    ]);
    const edges: GraphEdge[] = [
      { id: "a", source: 2, target: 3, layer: "manual", state: "confirmed", confidence: 1, crossDiscipline: false },
      { id: "b", source: 2, target: 3, layer: "tag", state: "confirmed", confidence: 1, crossDiscipline: false },
      { id: "c", source: 2, target: 3, layer: "note", state: "confirmed", confidence: 1, crossDiscipline: false },
      { id: "d", source: 2, target: 3, layer: "citation", state: "confirmed", confidence: 1, crossDiscipline: false },
    ];
    const hubs = findUnreadHubs(nodes, edges, index, { minDegree: 4, maxResults: 2 });
    expect(hubs[0]?.itemID).toBe(2);
    expect(hubs[0]?.degree).toBe(4);
  });
});
