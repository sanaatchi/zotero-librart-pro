// @ajan: cursor · @etiket: f9.2, zotseek, vitest
import { describe, expect, it } from "vitest";
import { evaluateZotSeekProbe } from "../src/utils/zotseekProbe";

describe("evaluateZotSeekProbe", () => {
  it("reports disabled when pref off", () => {
    const r = evaluateZotSeekProbe({
      prefEnabled: false,
      hasApiObject: true,
      hasSearch: true,
      hasFindSimilar: true,
      vendoredConfigured: true,
      vendoredReady: false,
    });
    expect(r.messageKey).toBe("zotseek-probe-disabled");
    expect(r.ready).toBe(false);
  });

  it("detects external plugin API", () => {
    const r = evaluateZotSeekProbe({
      prefEnabled: true,
      hasApiObject: true,
      hasSearch: true,
      hasFindSimilar: true,
      apiReady: true,
      vendoredConfigured: true,
      vendoredReady: false,
    });
    expect(r.mode).toBe("external");
    expect(r.ready).toBe(true);
    expect(r.messageKey).toBe("zotseek-probe-external-ready");
  });

  it("marks cold start when api present but not ready", () => {
    const r = evaluateZotSeekProbe({
      prefEnabled: true,
      hasApiObject: true,
      hasSearch: true,
      hasFindSimilar: false,
      apiReady: false,
      vendoredConfigured: false,
      vendoredReady: false,
    });
    expect(r.messageKey).toBe("zotseek-probe-external-cold");
    expect(r.ready).toBe(false);
  });

  it("reports missing plugin vs vendored stub", () => {
    expect(
      evaluateZotSeekProbe({
        prefEnabled: true,
        hasApiObject: false,
        hasSearch: false,
        hasFindSimilar: false,
        vendoredConfigured: false,
        vendoredReady: false,
      }).messageKey,
    ).toBe("zotseek-probe-missing");

    expect(
      evaluateZotSeekProbe({
        prefEnabled: true,
        hasApiObject: false,
        hasSearch: false,
        hasFindSimilar: false,
        vendoredConfigured: true,
        vendoredReady: false,
      }).messageKey,
    ).toBe("zotseek-probe-vendored-stub");
  });
});
