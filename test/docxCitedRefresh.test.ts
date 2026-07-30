// @ajan: cursor · @etiket: f3, docx-cited, vitest, stale-tag-sweep
import { describe, expect, it } from "vitest";
import { seedCitedByLibrary } from "../src/modules/docxCitedBridge";

describe("seedCitedByLibrary", () => {
  it("always includes user library even with no citations", () => {
    const map = seedCitedByLibrary([], 1, []);
    expect(map.has(1)).toBe(true);
    expect(map.get(1)!.size).toBe(0);
  });

  it("seeds empty sets for group libraries that need a tag sweep", () => {
    const map = seedCitedByLibrary([{ id: 10, libraryID: 1 }], 1, [42, 99]);
    expect([...map.get(1)!]).toEqual([10]);
    expect(map.has(42)).toBe(true);
    expect(map.get(42)!.size).toBe(0);
    expect(map.has(99)).toBe(true);
  });

  it("does not wipe citations already present in a sweep library", () => {
    const map = seedCitedByLibrary(
      [
        { id: 10, libraryID: 1 },
        { id: 20, libraryID: 42 },
      ],
      1,
      [42],
    );
    expect([...map.get(42)!]).toEqual([20]);
  });
});
