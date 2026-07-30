// @ajan: cursor · @etiket: f9, semantic, vitest
import { describe, expect, it } from "vitest";
import {
  buildKpIndexFromEntries,
  mapHitsToItemIds,
  normalizeSemanticBaseUrl,
  parseSearchPayload,
  parseStatusPayload,
  parseConnectionGraphPayload,
} from "../src/utils/kutuphaneSemanticParse";

describe("kutuphaneSemanticParse", () => {
  it("normalizes base URLs", () => {
    expect(normalizeSemanticBaseUrl("  http://127.0.0.1:8756/  ")).toBe(
      "http://127.0.0.1:8756",
    );
    expect(normalizeSemanticBaseUrl("")).toBeNull();
    expect(normalizeSemanticBaseUrl("not-a-url")).toBeNull();
  });

  it("rejects non-loopback HTTP targets by default", () => {
    expect(normalizeSemanticBaseUrl("http://evil.example:8756")).toBeNull();
    expect(
      normalizeSemanticBaseUrl("http://evil.example:8756", {
        loopbackOnly: false,
      }),
    ).toBe("http://evil.example:8756");
    expect(
      normalizeSemanticBaseUrl("http://semantic.local:8756", {
        allowHosts: ["semantic.local"],
      }),
    ).toBe("http://semantic.local:8756");
  });

  it("parses /status payload", () => {
    expect(
      parseStatusPayload({
        ready: true,
        backend: "ollama",
        model: "qwen3-embedding:8b",
        chunkCount: 55555,
        error: null,
      }),
    ).toEqual({
      ready: true,
      backend: "ollama",
      model: "qwen3-embedding:8b",
      chunkCount: 55555,
      error: null,
    });
    expect(parseStatusPayload(null).ready).toBe(false);
  });

  it("parses /search results and maps KP hits", () => {
    const hits = parseSearchPayload({
      results: [
        { kpId: "KP000001", text: "a", score: 0.9, pageNum: 1 },
        { kpId: "", text: "skip", score: 0.8 },
        { kpId: "KP000002", text: "b", score: 0.7, category: "bilim" },
        "bad",
      ],
    });
    expect(hits).toHaveLength(2);
    expect(hits[0].kpId).toBe("KP000001");

    const index = buildKpIndexFromEntries([
      { itemId: 10, citationKey: "KP000001" },
      { itemId: 20, citationKey: "CK999" },
      { itemId: 30, citationKey: "kp000002" },
    ]);
    expect(index.get("KP000001")).toBe(10);
    expect(index.get("KP000002")).toBe(30);
    expect(index.has("CK999")).toBe(false);

    const mapped = mapHitsToItemIds(hits, index, {
      excludeItemIds: [10],
      minScore: 0.5,
    });
    expect(mapped).toEqual([{ itemId: 30, similarity: 0.7, title: "b" }]);
  });

  it("parses /connection-graph payload", () => {
    const payload = parseConnectionGraphPayload({
      ok: true,
      version: 1,
      generatedAt: "2026-07-30T00:00:00Z",
      edges: [
        {
          id: "manual::A::B::",
          source: "AAAAAAA1",
          target: "BBBBBBB2",
          layer: "manual",
          state: "confirmed",
          confidence: 1,
        },
        { source: "x", target: "", layer: "tag" },
      ],
    });
    expect(payload?.edges).toHaveLength(1);
    expect(payload?.generatedAt).toBe("2026-07-30T00:00:00Z");
    expect(parseConnectionGraphPayload({ ok: false })).toBeNull();
  });

  it("parses /status connectionGraph summary", () => {
    const status = parseStatusPayload({
      ready: true,
      chunkCount: 100,
      connectionGraph: {
        ok: true,
        generatedAt: "2026-07-30T07:00:00Z",
        nodeCount: 889,
        edgeCount: 460,
      },
    });
    expect(status.connectionGraph?.ok).toBe(true);
    expect(status.connectionGraph?.edgeCount).toBe(460);
  });
});
