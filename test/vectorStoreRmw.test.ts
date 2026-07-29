// @ajan: cursor · @etiket: f9.2.3, vitest, vector-rmw
import { describe, expect, it } from "vitest";
import {
  emptyJsonVectorStore,
  type JsonVectorStoreFile,
} from "../src/vendor/zotseek/jsonVectorStore";
import { createVectorMutator } from "../src/vendor/zotseek/vectorStoreMutate";

describe("vector store RMW queue", () => {
  it("keeps both rows when two different items commit in parallel", async () => {
    let memory: JsonVectorStoreFile | null = emptyJsonVectorStore("t");
    const persisted: JsonVectorStoreFile[] = [];
    const mutator = createVectorMutator({
      getMemory: () => memory,
      setMemory: (s) => {
        memory = s;
      },
      load: async () => memory ?? emptyJsonVectorStore("t"),
      persist: async (s) => {
        await new Promise((r) => setTimeout(r, 5));
        persisted.push(s);
      },
    });

    await Promise.all([
      mutator.commitRow({
        itemId: 1,
        modelId: "t",
        embedding: [1, 0],
        indexedAt: "a",
        contentHash: "h1",
      }),
      mutator.commitRow({
        itemId: 2,
        modelId: "t",
        embedding: [0, 1],
        indexedAt: "b",
        contentHash: "h2",
      }),
    ]);

    expect(Object.keys(memory!.rows).sort()).toEqual(["1", "2"]);
    expect(persisted.at(-1)?.rows["1"]).toBeTruthy();
    expect(persisted.at(-1)?.rows["2"]).toBeTruthy();
  });

  it("last write wins for the same itemId", async () => {
    let memory: JsonVectorStoreFile | null = emptyJsonVectorStore("t");
    const mutator = createVectorMutator({
      getMemory: () => memory,
      setMemory: (s) => {
        memory = s;
      },
      load: async () => memory ?? emptyJsonVectorStore("t"),
      persist: async () => undefined,
    });

    await Promise.all([
      mutator.commitRow({
        itemId: 9,
        modelId: "t",
        embedding: [1],
        indexedAt: "a",
        contentHash: "old",
      }),
      mutator.commitRow({
        itemId: 9,
        modelId: "t",
        embedding: [2],
        indexedAt: "b",
        contentHash: "new",
      }),
    ]);

    expect(memory!.rows["9"].contentHash).toBe("new");
    expect(memory!.rows["9"].embedding).toEqual([2]);
  });

  it("drops stale embedding when a newer generation started for the same item", async () => {
    let memory: JsonVectorStoreFile | null = emptyJsonVectorStore("t");
    const mutator = createVectorMutator({
      getMemory: () => memory,
      setMemory: (s) => {
        memory = s;
      },
      load: async () => memory ?? emptyJsonVectorStore("t"),
      persist: async () => undefined,
    });

    const oldGen = mutator.beginGeneration(5);
    const newGen = mutator.beginGeneration(5);

    const fresh = await mutator.commitRow(
      {
        itemId: 5,
        modelId: "t",
        embedding: [9],
        indexedAt: "new",
        contentHash: "fresh",
      },
      newGen,
    );
    expect(fresh.applied).toBe(true);

    const stale = await mutator.commitRow(
      {
        itemId: 5,
        modelId: "t",
        embedding: [1],
        indexedAt: "old",
        contentHash: "stale",
      },
      oldGen,
    );
    expect(stale.applied).toBe(false);
    expect(stale.reason).toBe("stale-generation");
    expect(memory!.rows["5"].contentHash).toBe("fresh");
  });
});
