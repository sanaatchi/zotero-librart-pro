// @ajan: cursor · @etiket: f9.2, zotseek, probe
// Pure ZotSeek availability helpers — no WASM; external plugin detection only.

export type ZotSeekMode = "external" | "vendored" | "none";

export type ZotSeekProbeInput = {
  prefEnabled: boolean;
  hasApiObject: boolean;
  hasSearch: boolean;
  hasFindSimilar: boolean;
  apiReady?: boolean | null;
  vendoredConfigured: boolean;
  vendoredReady: boolean;
};

export type ZotSeekProbeResult = {
  prefEnabled: boolean;
  mode: ZotSeekMode;
  apiPresent: boolean;
  canSearch: boolean;
  canFindSimilar: boolean;
  ready: boolean;
  messageKey:
    | "zotseek-probe-disabled"
    | "zotseek-probe-external-ready"
    | "zotseek-probe-external-cold"
    | "zotseek-probe-missing"
    | "zotseek-probe-vendored-stub"
    | "zotseek-probe-vendored-ready";
};

export function evaluateZotSeekProbe(
  input: ZotSeekProbeInput,
): ZotSeekProbeResult {
  if (!input.prefEnabled) {
    return {
      prefEnabled: false,
      mode: "none",
      apiPresent: false,
      canSearch: false,
      canFindSimilar: false,
      ready: false,
      messageKey: "zotseek-probe-disabled",
    };
  }

  if (input.vendoredReady) {
    return {
      prefEnabled: true,
      mode: "vendored",
      apiPresent: true,
      canSearch: false,
      canFindSimilar: true,
      ready: true,
      messageKey: "zotseek-probe-vendored-ready",
    };
  }

  const apiPresent = input.hasApiObject;
  const canSearch = apiPresent && input.hasSearch;
  const canFindSimilar = apiPresent && input.hasFindSimilar;
  if (apiPresent && (canSearch || canFindSimilar)) {
    const ready =
      input.apiReady === true ||
      (input.apiReady == null && (canSearch || canFindSimilar));
    return {
      prefEnabled: true,
      mode: "external",
      apiPresent: true,
      canSearch,
      canFindSimilar,
      ready,
      messageKey: ready
        ? "zotseek-probe-external-ready"
        : "zotseek-probe-external-cold",
    };
  }

  if (input.vendoredConfigured) {
    return {
      prefEnabled: true,
      mode: "vendored",
      apiPresent: false,
      canSearch: false,
      canFindSimilar: false,
      ready: false,
      messageKey: "zotseek-probe-vendored-stub",
    };
  }

  return {
    prefEnabled: true,
    mode: "none",
    apiPresent: false,
    canSearch: false,
    canFindSimilar: false,
    ready: false,
    messageKey: "zotseek-probe-missing",
  };
}
