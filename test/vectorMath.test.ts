// @ajan: cursor · @etiket: f9.2.3, zotseek, vitest
import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  topKSimilar,
} from "../src/vendor/zotseek/vectorMath";
import {
  contentHashForText,
  emptyJsonVectorStore,
  listJsonVectorRows,
  upsertJsonVectorRow,
} from "../src/vendor/zotseek/jsonVectorStore";

describe("vectorMath", () => {
  it("computes cosine of identical unit vectors as 1", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns top-K above threshold", () => {
    const hits = topKSimilar(
      [1, 0],
      [
        { itemId: 1, embedding: [1, 0] },
        { itemId: 2, embedding: [0.9, 0.1] },
        { itemId: 3, embedding: [0, 1] },
      ],
      { topK: 2, minSimilarity: 0.5, excludeItemIds: [1] },
    );
    expect(hits.map((h) => h.itemId)).toEqual([2]);
  });
});

describe("jsonVectorStore", () => {
  it("upserts and lists rows", () => {
    let store = emptyJsonVectorStore("nomic");
    store = upsertJsonVectorRow(store, {
      itemId: 7,
      modelId: "nomic",
      embedding: [0.1, 0.2],
      indexedAt: "2026-01-01",
      contentHash: contentHashForText("hello"),
    });
    expect(listJsonVectorRows(store)).toHaveLength(1);
    expect(contentHashForText("hello")).toBe(contentHashForText("hello"));
    expect(contentHashForText("hello")).not.toBe(contentHashForText("bye"));
  });
});
