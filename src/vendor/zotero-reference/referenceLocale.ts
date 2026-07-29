// Adapted from zotero-reference (AGPL-3.0) addon/locale/en-US/addon.ftl (minimal subset)

const STRINGS: Record<string, string> = {
  "prefs-label": "Reference",
  "tabpanel-reader-tab-label": "References",
  "relatedbox-number-label": "references:",
  "relatedbox-refresh-label": "Refresh",
  "relatedbox-search-placeholder": "Search References",
};

export function initReferenceLocale(): void {
  // Fluent strings inlined for vendored reader UI.
}

export function getReferenceString(key: string): string {
  return STRINGS[key] ?? key;
}
