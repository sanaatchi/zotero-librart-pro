// Adapted from zotero-reference (AGPL-3.0) src/modules/views.ts — reader sidebar + floating tip.

import { ReferenceViews } from "../vendor/zotero-reference";

export { initReferenceReader, getReferenceViews };

let views: ReferenceViews | null = null;

async function initReferenceReader(): Promise<void> {
  if (views) return;
  try {
    views = new ReferenceViews();
    await views.onInit();
  } catch (e) {
    views = null;
    ztoolkit.log("Reference reader init failed (vendored zotero-reference)", e);
  }
}

function getReferenceViews(): ReferenceViews | null {
  return views;
}
