// @ajan: cursor · @etiket: scale, vitest, smoke-10k
import { describe, expect, it } from "vitest";
import {
  emptyJsonVectorStore,
  listJsonVectorRows,
  upsertJsonVectorRow,
} from "../src/vendor/zotseek/jsonVectorStore";
import { topKSimilar } from "../src/vendor/zotseek/vectorMath";

const N = 10_000;

function emb(i: number): number[] {
  // Cheap deterministic 8-d unit-ish vector
  const v = [
    Math.sin(i),
    Math.cos(i),
    Math.sin(i / 2),
    Math.cos(i / 3),
    Math.sin(i / 5),
    Math.cos(i / 7),
    Math.sin(i / 11),
    Math.cos(i / 13),
  ];
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

describe("10k vector-helper smoke", () => {
  it("upserts and lists 10000 vector rows", () => {
    let store = emptyJsonVectorStore("smoke");
    const t0 = Date.now();
    for (let i = 1; i <= N; i++) {
      store = upsertJsonVectorRow(store, {
        itemId: i,
        modelId: "smoke",
        embedding: emb(i),
        indexedAt: "t",
        contentHash: String(i),
      });
    }
    const rows = listJsonVectorRows(store, { modelId: "smoke" });
    expect(rows).toHaveLength(N);
    expect(Date.now() - t0).toBeLessThan(15_000);
  });

  it("topKSimilar over 10000 catalog rows", () => {
    const catalog = Array.from({ length: N }, (_, i) => ({
      itemId: i + 1,
      embedding: emb(i + 1),
    }));
    const query = emb(42);
    const t0 = Date.now();
    const hits = topKSimilar(query, catalog, {
      topK: 10,
      excludeItemIds: [42],
    });
    expect(hits).toHaveLength(10);
    expect(hits[0].similarity).toBeGreaterThan(0.5);
    expect(Date.now() - t0).toBeLessThan(10_000);
  });
});
