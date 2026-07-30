// @ajan: cursor · @etiket: kutuphane-graph, vitest, f5
import { describe, expect, it } from "vitest";
import type { GraphNode } from "../src/utils/connectionGraph";
import {
  edgesFromKutuphanePayload,
  evaluateKutuphaneGraphWarnings,
} from "../src/utils/kutuphaneConnectionGraphLayer";
import type { KutuphaneConnectionGraphPayload } from "../src/utils/kutuphaneSemanticParse";

function node(itemID: number, key: string): GraphNode {
  return {
    itemID,
    key,
    libraryID: 1,
    title: key,
    creatorSummary: "",
    itemType: "book",
    disciplineIDs: [1],
    disciplineLabels: ["Test"],
    tagCount: 0,
  };
}

describe("kutuphaneConnectionGraphLayer", () => {
  it("maps offline edges only within scope nodes", () => {
    const nodes = new Map<number, GraphNode>([
      [10, node(10, "KEYAAAAA")],
      [20, node(20, "KEYBBBBB")],
    ]);
    const payload: KutuphaneConnectionGraphPayload = {
      edges: [
        {
          id: "manual::KEYAAAAA::KEYBBBBB::",
          source: "KEYAAAAA",
          target: "KEYBBBBB",
          layer: "manual",
          state: "confirmed",
          confidence: 1,
        },
        {
          id: "tag::KEYAAAAA::KEYZZZZZ::",
          source: "KEYAAAAA",
          target: "KEYZZZZZ",
          layer: "tag",
          state: "confirmed",
          confidence: 1,
        },
        {
          id: "doi::KEYAAAAA::KEYBBBBB::x",
          source: "KEYAAAAA",
          target: "KEYBBBBB",
          layer: "doi",
          state: "suggested",
          confidence: 0.85,
          via: { doi: "10.1234/x" },
        },
      ],
    };
    const edges = edgesFromKutuphanePayload(payload, nodes);
    expect(edges).toHaveLength(2);
    expect(edges.some((e) => e.layer === "citation" && e.state === "suggested")).toBe(
      true,
    );
    expect(edges.every((e) => nodes.has(e.source) && nodes.has(e.target))).toBe(
      true,
    );
    expect(edges.every((e) => e.kutuphaneOffline)).toBe(true);
  });

  it("maps semantic offline layer", () => {
    const nodes = new Map<number, GraphNode>([
      [10, node(10, "KEYAAAAA")],
      [20, node(20, "KEYBBBBB")],
    ]);
    const payload: KutuphaneConnectionGraphPayload = {
      edges: [
        {
          id: "semantic::KEYAAAAA::KEYBBBBB::",
          source: "KEYAAAAA",
          target: "KEYBBBBB",
          layer: "semantic",
          state: "suggested",
          confidence: 0.72,
        },
      ],
    };
    const edges = edgesFromKutuphanePayload(payload, nodes);
    expect(edges).toHaveLength(1);
    expect(edges[0].layer).toBe("semantic");
    expect(edges[0].state).toBe("suggested");
  });

  it("warns on low in-scope ratio and stale graph", () => {
    const now = Date.parse("2026-07-30T12:00:00Z");
    const warns = evaluateKutuphaneGraphWarnings(
      {
        generatedAt: "2026-01-01T00:00:00Z",
        inScope: 2,
        totalEdges: 400,
      },
      now,
    );
    expect(warns.some((w) => w.kind === "lowInScope")).toBe(true);
    expect(warns.some((w) => w.kind === "stale" && w.days >= 14)).toBe(true);
  });
});
