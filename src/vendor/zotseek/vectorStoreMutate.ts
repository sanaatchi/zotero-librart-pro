// @ajan: cursor · @etiket: f9.2.3, zotseek, vector-mutate, rmw, generation
// Pure serialized RMW for JSON vector rows — no Zotero globals.

import {
  JsonVectorRow,
  JsonVectorStoreFile,
  removeJsonVectorRow,
  upsertJsonVectorRow,
} from "./jsonVectorStore";
import { createSerialQueue } from "./serialQueue";

export type VectorMutateDeps = {
  load: () => Promise<JsonVectorStoreFile>;
  persist: (store: JsonVectorStoreFile) => Promise<void>;
  getMemory: () => JsonVectorStoreFile | null;
  setMemory: (store: JsonVectorStoreFile) => void;
};

export type CommitRowResult = {
  store: JsonVectorStoreFile;
  applied: boolean;
  reason?: "stale-generation" | "unchanged";
};

export { createVectorMutator };

function createVectorMutator(deps: VectorMutateDeps) {
  const queue = createSerialQueue();
  /** Per-item generation — bump before embed; commit only if still current. */
  const generations = new Map<number, number>();

  function beginGeneration(itemId: number): number {
    const next = (generations.get(itemId) ?? 0) + 1;
    generations.set(itemId, next);
    return next;
  }

  async function commitRow(
    row: JsonVectorRow,
    generation?: number,
  ): Promise<CommitRowResult> {
    return queue(async () => {
      const current = deps.getMemory() ?? (await deps.load());
      if (
        generation !== undefined &&
        generations.get(row.itemId) !== generation
      ) {
        deps.setMemory(current);
        return { store: current, applied: false, reason: "stale-generation" };
      }
      const existing = current.rows[String(row.itemId)];
      if (
        existing &&
        existing.contentHash === row.contentHash &&
        existing.modelId === row.modelId
      ) {
        deps.setMemory(current);
        return { store: current, applied: false, reason: "unchanged" };
      }
      const next = upsertJsonVectorRow(current, row);
      await deps.persist(next);
      deps.setMemory(next);
      return { store: next, applied: true };
    });
  }

  async function removeRow(itemId: number): Promise<boolean> {
    return queue(async () => {
      const current = deps.getMemory() ?? (await deps.load());
      if (!current.rows[String(itemId)]) {
        deps.setMemory(current);
        return false;
      }
      const next = removeJsonVectorRow(current, itemId);
      await deps.persist(next);
      deps.setMemory(next);
      generations.delete(itemId);
      return true;
    });
  }

  return { beginGeneration, commitRow, removeRow };
}
