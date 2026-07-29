// @ajan: cursor · @etiket: f1, vitest, items, adapter
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createZoteroAdapter,
  setZoteroAdapter,
  type ZoteroAdapter,
} from "../src/adapters/zoteroAdapter";
import { getItemIDsByKey } from "../src/utils/items";

afterEach(() => {
  setZoteroAdapter(null);
});

describe("getItemIDsByKey via adapter", () => {
  it("resolves keys through the injected adapter", () => {
    const getItemByLibraryAndKey = vi.fn((libraryID: number, key: string) => {
      if (key === "ABC123") return { id: 42 } as Zotero.Item;
      return false;
    });
    const adapter: ZoteroAdapter = {
      waitForReady: async () => {},
      getActivePane: () => undefined,
      getSelectedTabType: () => "library",
      getSelectedTabId: () => "tab1",
      getItemByLibraryAndKey,
      getAllItems: async () => [],
      findReaderByInstanceId: () => undefined,
      getReaderByTabId: () => undefined,
    };
    setZoteroAdapter(adapter);
    expect(getItemIDsByKey(1, "ABC123", "MISSING")).toEqual([42]);
    expect(getItemByLibraryAndKey).toHaveBeenCalledWith(1, "ABC123");
  });
});

describe("createZoteroAdapter", () => {
  it("returns a fresh adapter instance", () => {
    const a = createZoteroAdapter();
    expect(typeof a.waitForReady).toBe("function");
    expect(typeof a.getActivePane).toBe("function");
  });
});
