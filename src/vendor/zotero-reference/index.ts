// Adapted from zotero-reference (AGPL-3.0) — shared singleton for API/Utils/PDF.

import ReferenceAPI from "./api";
import ReferenceUtils from "./utils";

let _utils: ReferenceUtils | null = null;

export function getReferenceUtils(): ReferenceUtils {
  if (!_utils) {
    _utils = new ReferenceUtils();
  }
  return _utils;
}

export function getReferenceAPI(): ReferenceAPI {
  return getReferenceUtils().API;
}

export { default as ReferencePDF } from "./pdf";
export { default as ReferenceRequests } from "./requests";
export { default as ReferenceViews } from "./views";
export { default as ReferenceTipUI } from "./tip";
