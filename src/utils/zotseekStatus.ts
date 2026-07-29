// @ajan: cursor · @etiket: f9.2, zotseek, status
// Live ZotSeek probe against Zotero.ZotSeek + vendored stub.

import { getPref } from "./prefs";
import { evaluateZotSeekProbe, type ZotSeekProbeResult } from "./zotseekProbe";
import {
  isVendoredZotSeekConfigured,
  isVendoredZotSeekReady,
} from "../vendor/zotseek/vendoredSemantic";

export async function probeZotSeekStatus(): Promise<ZotSeekProbeResult> {
  const prefEnabled = getPref("semantic.zotseek.enabled") === true;
  let hasApiObject = false;
  let hasSearch = false;
  let hasFindSimilar = false;
  let apiReady: boolean | null = null;

  try {
    const zotseek = (Zotero as { ZotSeek?: { api?: Record<string, unknown> } })
      .ZotSeek;
    const api = zotseek?.api;
    if (api && typeof api === "object") {
      hasApiObject = true;
      hasSearch = typeof api.search === "function";
      hasFindSimilar = typeof api.findSimilar === "function";
      if (typeof api.isReady === "function") {
        try {
          apiReady = !!(api.isReady as () => boolean)();
        } catch {
          apiReady = null;
        }
      }
    }
  } catch {
    /* soft */
  }

  return evaluateZotSeekProbe({
    prefEnabled,
    hasApiObject,
    hasSearch,
    hasFindSimilar,
    apiReady,
    vendoredConfigured: isVendoredZotSeekConfigured(),
    vendoredReady: await isVendoredZotSeekReady(),
  });
}
