// Adapted from ZotSeek (MIT) — vendored embedding pipeline entry (staged).

import { config } from "../../../package.json";

export { isVendoredZotSeekConfigured, isVendoredZotSeekReady, vendoredFindSimilar };

/**
 * Vendored ZotSeek worker + vector store sources live under src/vendor/zotseek/.
 * WASM/model assets must be copied from a ZotSeek release build into addon/content/
 * before init succeeds. Until then this reports not-ready and the semantic layer
 * falls back to Kutuphane bridge or external ZotSeek plugin.
 */
function isVendoredZotSeekConfigured(): boolean {
  return (
    Zotero.Prefs.get(`${config.prefsPrefix}.vendoredZotSeek`, true) !== false
  );
}

async function isVendoredZotSeekReady(): Promise<boolean> {
  if (!isVendoredZotSeekConfigured()) return false;
  // Stage 2: wire EmbeddingPipeline when addon/content/scripts + wasm are bundled.
  return false;
}

async function vendoredFindSimilar(
  _itemId: number,
  _options: { topK?: number; minSimilarity?: number } = {},
): Promise<Array<{ itemId: number; similarity: number }>> {
  return [];
}
