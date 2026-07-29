// @ajan: cursor · @etiket: f0, vitest, tag-analysis
import { describe, expect, it } from "vitest";
import { foldTag, similarity } from "../src/utils/tagAnalysis";

describe("foldTag", () => {
  it("normalizes Turkish casing and diacritics", () => {
    expect(foldTag("Fotoğraf")).toBe("fotograf");
    expect(foldTag("  İstanbul  ")).toBe("istanbul");
  });

  it("collapses separators", () => {
    expect(foldTag("sanat_tarihi")).toBe("sanat tarihi");
    expect(foldTag("a/b/c")).toBe("a b c");
  });
});

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("fotograf", "fotograf")).toBe(1);
  });

  it("ranks near duplicates higher than unrelated tags", () => {
    const near = similarity("fotograf", "fotograflar");
    const far = similarity("fotograf", "felsefe");
    expect(near).toBeGreaterThan(far);
  });
});
