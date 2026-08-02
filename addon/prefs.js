// @ajan: cursor · @etiket: prefs, reading-off-default
/* eslint-disable no-undef */
pref("__prefsPrefix__.rulesInit", false);
pref("__prefsPrefix__.ruleWarningDisabled", false);
pref("__prefsPrefix__.deleteMessageDisabled", false);
pref("__prefsPrefix__.menuSortBy", "menu");
pref("__prefsPrefix__.showPopup", true);
pref("__prefsPrefix__.rulesSortColumnIndex", 0);
pref("__prefsPrefix__.rulesSortColumnAscending", false);
/* Core writing features (default on) */
pref("__prefsPrefix__.inciteful.enabled", true);
pref("__prefsPrefix__.reading.enabled", false);
pref("__prefsPrefix__.import.enabled", true);
pref("__prefsPrefix__.docxCited.enabled", true);
/* Connection Map — D(iii) highlight→semantic (default on, rate-limited). */
pref("__prefsPrefix__.connectionMapEnableHighlightLayer", true);
/* Timeline JSON (capped). */
pref("__prefsPrefix__.connectionMapTimelineJson", "[]");
/* Local book DB bridge — empty path disables the feature. */
pref("__prefsPrefix__.openLibraryDbPath", "");
pref("__prefsPrefix__.kitaplarDbPath", "");
pref("__prefsPrefix__.kutuphaneSemanticUrl", "");
/* F5 — citation layers / OpenAlex polite pool */
pref("__prefsPrefix__.citation.layers.crossref", true);
pref("__prefsPrefix__.citation.layers.openalex", true);
pref("__prefsPrefix__.citation.layers.openCitations", false);
pref("__prefsPrefix__.openalex.mailto", "");
pref("__prefsPrefix__.openalex.cacheDays", 30);
/* F7 — AnkiConnect (opt-in) */
pref("__prefsPrefix__.anki.enabled", false);
pref("__prefsPrefix__.anki.host", "http://127.0.0.1");
pref("__prefsPrefix__.anki.port", 8765);
pref("__prefsPrefix__.anki.key", "");
pref("__prefsPrefix__.anki.deckName", "LibRart");
pref("__prefsPrefix__.anki.modelName", "Basic");
/* F8 — MarkDB / Obsidian vault (opt-in) */
pref("__prefsPrefix__.note.markdb.enabled", false);
pref("__prefsPrefix__.note.markdb.vaultPath", "");
pref("__prefsPrefix__.note.markdb.matchStrategy", "citekeyyaml");
pref("__prefsPrefix__.note.markdb.tag", "mdbc");
/* F9 — Semantic (Kutuphane 8756 primary; ZotSeek opt-in) */
pref("__prefsPrefix__.semantic.kutuphane.enabled", false);
pref("__prefsPrefix__.semantic.kutuphaneUrl", "http://127.0.0.1:8756");
pref("__prefsPrefix__.semantic.kutuphane.graph.enabled", true);
pref("__prefsPrefix__.semantic.zotseek.enabled", false);
/* F8.2 — Better Notes–compatible note links (opt-in; full workspace later) */
pref("__prefsPrefix__.note.workspace.enabled", false);
/* Deneysel — Citegeist-style OpenAlex atıf özeti (opt-in) */
pref("__prefsPrefix__.citegeist.enabled", false);
/* RefChecker HTTP (opt-in; external MIT service on :8000) */
pref("__prefsPrefix__.refchecker.enabled", false);
pref("__prefsPrefix__.refchecker.url", "http://127.0.0.1:8000");
/* Katman 1 AI (arsiv_app) for writing tips */
pref("__prefsPrefix__.kutuphane.aiUrl", "http://127.0.0.1:8077");
/* F9.2 — vendored ZotSeek assets (ONNX/WASM via fetch script; default on) */
pref("__prefsPrefix__.vendoredZotSeek", true);
pref("__prefsPrefix__.embeddingModel", "nomic-embed-text-v1.5");
