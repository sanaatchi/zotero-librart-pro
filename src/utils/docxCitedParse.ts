// @ajan: cursor · @etiket: f3, docx-cited, parse
// Logic adapted from zotero-tag-cited (MIT) tagCited.js

export {
  unescapeXml,
  extractBalancedJson,
  combineInstrTextRuns,
  extractCitationUrisFromInstrText,
  extractCitationUrisFromDocumentXml,
  buildCitedTag,
};

const INSTR_TEXT_RE = /<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g;
const CSL_MARKER_RE = /CSL_CITATION/g;

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractBalancedJson(text: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

function combineInstrTextRuns(xml: string): string {
  let combined = "";
  INSTR_TEXT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INSTR_TEXT_RE.exec(xml)) !== null) {
    combined += unescapeXml(match[1]);
  }
  return combined;
}

function extractCitationUrisFromInstrText(combined: string): Set<string> {
  const uris = new Set<string>();
  CSL_MARKER_RE.lastIndex = 0;
  let markerMatch: RegExpExecArray | null;
  while ((markerMatch = CSL_MARKER_RE.exec(combined)) !== null) {
    const braceStart = combined.indexOf("{", markerMatch.index);
    if (braceStart === -1) continue;
    const json = extractBalancedJson(combined, braceStart);
    if (!json) continue;
    try {
      const citation = JSON.parse(json) as {
        citationItems?: Array<{ uris?: string[] }>;
      };
      for (const citationItem of citation.citationItems || []) {
        for (const uri of citationItem.uris || []) {
          if (uri) uris.add(uri);
        }
      }
    } catch {
      /* skip malformed field code */
    }
  }
  return uris;
}

function extractCitationUrisFromDocumentXml(xml: string): string[] {
  const combined = combineInstrTextRuns(xml);
  return [...extractCitationUrisFromInstrText(combined)];
}

function buildCitedTag(suffix: string): string {
  const trimmed = suffix.trim();
  return trimmed.startsWith("cited:") ? trimmed : `cited:${trimmed}`;
}
