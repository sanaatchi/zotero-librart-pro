// @ajan: cursor · @etiket: manuscript-diff, test, makale-yazim
import { describe, expect, it } from "vitest";
import {
  computeManuscriptDiff,
  formatManuscriptDiffSummary,
} from "../src/utils/manuscriptDiff";

describe("computeManuscriptDiff", () => {
  it("splits cited / unused / outside", () => {
    const r = computeManuscriptDiff({
      citedIds: [1, 2, 9],
      scopeIds: [2, 3, 4],
    });
    expect(r.citedCount).toBe(3);
    expect(r.scopeCount).toBe(3);
    expect(r.citedInScope).toEqual([2]);
    expect(r.unusedInScope).toEqual([3, 4]);
    expect(r.citedOutsideScope).toEqual([1, 9]);
  });

  it("ignores invalid ids", () => {
    const r = computeManuscriptDiff({
      citedIds: [0, -1, 5],
      scopeIds: [5],
    });
    expect(r.citedInScope).toEqual([5]);
    expect(r.unusedInScope).toEqual([]);
  });
});

describe("formatManuscriptDiffSummary", () => {
  it("fills placeholders", () => {
    const text = formatManuscriptDiffSummary({
      tag: "cited:ms1",
      result: computeManuscriptDiff({ citedIds: [1], scopeIds: [1, 2] }),
      labels: {
        title: "Diff",
        cited: "Cited {cited} in {inScope}",
        unused: "Unused {unused}",
        outside: "Outside {outside}",
      },
    });
    expect(text).toContain("cited:ms1");
    expect(text).toContain("Cited 1 in 1");
    expect(text).toContain("Unused 1");
  });
});
