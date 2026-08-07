// @ajan: cursor · @etiket: katman-3, citation-key, vitest, kp-preserve
import { describe, expect, it } from "vitest";
import { shouldSkipCitationKeyWrite } from "../src/utils/citationKey";
import { normalizeKp } from "../src/utils/kpToken";

describe("citationKey Extra policy", () => {
  it("skips write when Citation Key already present", () => {
    expect(shouldSkipCitationKeyWrite("Citation Key: KP001353\n")).toBe(true);
    expect(shouldSkipCitationKeyWrite("Citation Key: CK000001\n")).toBe(true);
    expect(shouldSkipCitationKeyWrite("Rate: 3\n")).toBe(false);
    expect(shouldSkipCitationKeyWrite("")).toBe(false);
  });

  it("treats valid KP Citation Key as preservable (normalizeKp)", () => {
    expect(normalizeKp("KP1353")).toBe("KP001353");
    expect(normalizeKp("KP0")).toBeNull();
    expect(normalizeKp("smith2020")).toBeNull();
  });
});
