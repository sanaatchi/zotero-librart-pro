// @ajan: cursor · @etiket: f8, markdb, vendor, scan
// Adapted from zotero-markdb-connect mdbcScan.ts (MIT) — pure parse helpers only.

import type { MarkdbMatchStrategy, MarkdbParsedNote } from "./markdbTypes";

export {
  DEFAULT_MD_FILE_RE,
  FILENAME_CITEKEY_RE,
  isMarkdownNoteFilename,
  extractCitekeyFromFilename,
  extractCitekeyFromYaml,
  extractItemKeyFromFrontmatter,
  extractBodyCitekeys,
  extractBodyItemKeys,
  parseMarkdownNote,
};

/** Default MarkDB file filter: notes named `@citekey….md`. */
const DEFAULT_MD_FILE_RE = /^@.+\.md$/i;
const FILENAME_CITEKEY_RE = /^@(\S+).*\.md$/i;
const YAML_CITEKEY_KEYS = ["citekey", "citationKey", "Citation Key"];
const ITEM_KEY_FM_RE =
  /^(?:zotero-key|zotkey|itemKey|item-key):\s*['"]?([A-Z0-9]{8})['"]?\s*$/im;
const ITEM_KEY_BODY_RE = /\b([A-Z0-9]{8})\b/g;
const WIKILINK_CITEKEY_RE = /\[\[@([^\]]+)\]\]/g;
const AT_CITEKEY_RE = /(?:^|[\s(])@([A-Za-z][\w:.-]*)/g;

function isMarkdownNoteFilename(name: string): boolean {
  return DEFAULT_MD_FILE_RE.test(name);
}

function extractCitekeyFromFilename(filename: string): string {
  const m = filename.match(FILENAME_CITEKEY_RE);
  return m?.[1]?.trim() || "";
}

function splitFrontmatter(content: string): { yaml: string; body: string } {
  if (!content.startsWith("---")) {
    return { yaml: "", body: content };
  }
  const end = content.indexOf("\n---", 3);
  if (end < 0) return { yaml: "", body: content };
  const yaml = content.slice(3, end).trim();
  const body = content.slice(end + 4);
  return { yaml, body };
}

function extractCitekeyFromYaml(content: string, keyword = "citekey"): string {
  const { yaml } = splitFrontmatter(content);
  if (!yaml) return "";
  const keys = keyword ? [keyword, ...YAML_CITEKEY_KEYS] : YAML_CITEKEY_KEYS;
  const seen = new Set<string>();
  for (const key of keys) {
    const k = key.trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    const re = new RegExp(
      `^${escapeRegExp(k)}:\\s*(?:['"])?(\\S+?)(?:['"]|\\s|$)`,
      "im",
    );
    const m = yaml.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function extractItemKeyFromFrontmatter(content: string): string {
  const { yaml } = splitFrontmatter(content);
  if (!yaml) return "";
  const m = yaml.match(ITEM_KEY_FM_RE);
  return m?.[1]?.trim().toUpperCase() || "";
}

function cleanCitekey(ck: string): string {
  return ck.replace(/[.,;:!?)]+$/g, "").trim();
}

function extractBodyCitekeys(content: string, exclude: string = ""): string[] {
  const { body } = splitFrontmatter(content);
  const found = new Set<string>();
  const excludeLower = exclude.toLowerCase();

  for (const re of [WIKILINK_CITEKEY_RE, AT_CITEKEY_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const ck = cleanCitekey(m[1] || "");
      if (!ck) continue;
      if (excludeLower && ck.toLowerCase() === excludeLower) continue;
      found.add(ck);
    }
  }
  return [...found];
}

function extractBodyItemKeys(
  content: string,
  excludeKey: string = "",
): string[] {
  const found = new Set<string>();
  const exclude = excludeKey.toUpperCase();
  ITEM_KEY_BODY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ITEM_KEY_BODY_RE.exec(content))) {
    const key = (m[1] || "").toUpperCase();
    if (!key || key === exclude) continue;
    // Skip common false positives (years, hex colors already 6 chars)
    if (/^\d{8}$/.test(key)) continue;
    found.add(key);
  }
  return [...found];
}

function parseMarkdownNote(
  filename: string,
  path: string,
  content: string,
  strategy: MarkdbMatchStrategy = "citekeyyaml",
  yamlKeyword = "citekey",
): MarkdbParsedNote {
  const name = filename.replace(/\.md$/i, "");
  const fromFile = extractCitekeyFromFilename(filename);
  const fromYaml = extractCitekeyFromYaml(content, yamlKeyword);
  const primaryCitekey =
    strategy === "citekeyyaml" ? fromYaml || fromFile : fromFile;
  const primaryItemKey =
    strategy === "zotitemkey" ? extractItemKeyFromFrontmatter(content) : "";

  const refCitekeys = extractBodyCitekeys(content, primaryCitekey);
  const refItemKeys = extractBodyItemKeys(content, primaryItemKey);

  return {
    name,
    path,
    primaryCitekey,
    primaryItemKey,
    refCitekeys,
    refItemKeys,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
