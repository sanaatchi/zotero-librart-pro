// @ajan: cursor · @etiket: f0, vitest, mock
/**
 * Minimal globals for modules that reference Zotero at type-check time only.
 * Unit tests should prefer pure utils that do not call these.
 */
(globalThis as Record<string, unknown>).Zotero = undefined;
