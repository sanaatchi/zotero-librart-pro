// @ajan: cursor · @etiket: f2, vitest, safe-import
import { describe, expect, it } from "vitest";
import {
  buildPreviewRows,
  cslItemToCandidate,
  defaultImportSelection,
  dedupeKeyForCandidate,
} from "../src/utils/safeImportParse";

describe("safeImportParse", () => {
  it("maps CSL item to candidate", () => {
    const c = cslItemToCandidate(
      {
        itemType: "journalArticle",
        title: "Test Article",
        date: "2020",
        DOI: "10.1234/example",
        creators: [{ creatorType: "author", firstName: "Ada", lastName: "Lovelace" }],
      },
      "r1",
    );
    expect(c.title).toBe("Test Article");
    expect(c.year).toBe(2020);
    expect(c.identifier).toBe("DOI:10.1234/example");
    expect(c.authors).toContain("Ada Lovelace");
  });

  it("flags batch duplicates and default selection skips them", () => {
    const rows = buildPreviewRows([
      cslItemToCandidate({ title: "Same", DOI: "10.1/x" }, "a"),
      cslItemToCandidate({ title: "Same copy", DOI: "10.1/x" }, "b"),
    ]);
    expect(rows[1].warnings.some((w) => w.kind === "duplicate-batch")).toBe(true);
    const selected = defaultImportSelection(rows);
    expect(selected.has("a")).toBe(true);
    expect(selected.has("b")).toBe(false);
  });

  it("dedupe key prefers identifier", () => {
    const key = dedupeKeyForCandidate(
      cslItemToCandidate({ title: "T", DOI: "10.9/z" }, "x"),
    );
    expect(key).toBe("doi:10.9/z");
  });
});
