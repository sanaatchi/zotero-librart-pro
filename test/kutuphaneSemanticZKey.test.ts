// @ajan: cursor · @etiket: semantic, z-key-map, vitest
import { describe, expect, it } from "vitest";
import {
  buildKpIndexFromEntries,
  mapHitsToItemIds,
  normalizeHitDocId,
} from "../src/utils/kutuphaneSemanticParse";

describe("normalizeHitDocId", () => {
  it("uppercases and pads KP ids", () => {
    expect(normalizeHitDocId("kp000001")).toBe("KP000001");
    expect(normalizeHitDocId("KP42")).toBe("KP000042");
  });
  it("rejects oversized KP digits", () => {
    expect(normalizeHitDocId("KP1234567")).toBeNull();
  });
  it("maps z:KEY", () => {
    expect(normalizeHitDocId("z:TyAh9IeC")).toBe("Z:TYAH9IEC");
  });
  it("rejects zpath and stems", () => {
    expect(normalizeHitDocId("zpath:felsefe/a.pdf")).toBeNull();
    expect(normalizeHitDocId("Adorno T. (2017)")).toBeNull();
  });
});

describe("buildKpIndex + mapHits z:KEY", () => {
  it("maps z: hits via item.key", () => {
    const idx = buildKpIndexFromEntries([
      { itemId: 42, citationKey: null, zoteroKey: "TYAH9IEC" },
      { itemId: 7, citationKey: "KP000100", zoteroKey: "AAAA1111" },
    ]);
    expect(idx.get("Z:TYAH9IEC")).toBe(42);
    expect(idx.get("KP000100")).toBe(7);
    const mapped = mapHitsToItemIds(
      [
        {
          kpId: "z:tyah9iec",
          category: "felsefe",
          text: "hit",
          sourceFile: "x.pdf",
          pageNum: 1,
          score: 0.9,
        },
      ],
      idx,
    );
    expect(mapped).toEqual([{ itemId: 42, similarity: 0.9, title: "hit" }]);
  });
});
