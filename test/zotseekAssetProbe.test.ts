// @ajan: cursor · @etiket: f9.2.2, zotseek, vitest
import { describe, expect, it } from "vitest";
import {
  evaluateVendoredAssetPresence,
  isLikelyLfsPointerSize,
  MIN_ONNX_BYTES,
} from "../src/vendor/zotseek/assetProbe";
import { evaluateZotSeekProbe } from "../src/utils/zotseekProbe";

describe("vendored assetProbe", () => {
  it("detects LFS pointer sizes", () => {
    expect(isLikelyLfsPointerSize(134)).toBe(true);
    expect(isLikelyLfsPointerSize(MIN_ONNX_BYTES)).toBe(false);
  });

  it("requires onnx + wasm + worker", () => {
    expect(
      evaluateVendoredAssetPresence({
        onnxBytes: 134,
        wasmBytes: 20_000_000,
        workerBytes: 200_000,
      }).reason,
    ).toBe("lfs-pointer");

    expect(
      evaluateVendoredAssetPresence({
        onnxBytes: 130_000_000,
        wasmBytes: 20_000_000,
        workerBytes: 200_000,
      }),
    ).toMatchObject({ ready: true, reason: "ok" });

    expect(
      evaluateVendoredAssetPresence({
        onnxBytes: 130_000_000,
        wasmBytes: 20_000_000,
        workerBytes: 100,
      }).reason,
    ).toBe("missing-worker");
  });
});

describe("evaluateZotSeekProbe + vendored ready", () => {
  it("prefers vendored-ready message", () => {
    const r = evaluateZotSeekProbe({
      prefEnabled: true,
      hasApiObject: false,
      hasSearch: false,
      hasFindSimilar: false,
      vendoredConfigured: true,
      vendoredReady: true,
    });
    expect(r.messageKey).toBe("zotseek-probe-vendored-ready");
    expect(r.mode).toBe("vendored");
  });
});
