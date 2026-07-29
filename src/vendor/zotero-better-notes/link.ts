// @ajan: cursor · @etiket: f8.2, better-notes, vendor, link
// Adapted from zotero-better-notes (AGPL-3.0) src/utils/link.ts — thin URL helpers only.

export type NoteLinkOptions = {
  ignore?: boolean;
  lineIndex?: number;
  sectionName?: string;
  selectionText?: string;
};

export type ParsedNoteLink = {
  libraryToken: string;
  noteKey: string;
  ignore?: boolean;
  lineIndex?: number;
  sectionName?: string;
  selectionText?: string;
};

export {
  buildNoteLink,
  parseNoteLinkHref,
  buildNoteLinkAnchorHtml,
  escapeNoteLinkText,
};

function escapeNoteLinkText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addParam(link: string, param: string): string {
  const lastChar = link[link.length - 1];
  if (lastChar === "/") {
    return `${link}?${param}`;
  }
  if (lastChar !== "?" && lastChar !== "&") {
    return `${link}&${param}`;
  }
  return `${link}${param}`;
}

/**
 * Build a Better Notes–compatible note URL.
 * User libraries use `u`; group libraries use the numeric library id (BN writer form).
 */
function buildNoteLink(
  libraryToken: "u" | string,
  noteKey: string,
  options: NoteLinkOptions = {},
): string {
  const key = noteKey.trim();
  if (!key) return "";
  let link = `zotero://note/${libraryToken}/${key}/`;
  if (options.ignore) link = addParam(link, "ignore=1");
  if (typeof options.lineIndex === "number" && Number.isFinite(options.lineIndex)) {
    link = addParam(link, `line=${Math.floor(options.lineIndex)}`);
  }
  if (options.sectionName) {
    link = addParam(
      link,
      `section=${encodeURIComponent(options.sectionName)}`,
    );
  }
  if (options.selectionText) {
    link = `${link}#${encodeURIComponent(options.selectionText)}`;
  }
  return link;
}

function parseNoteLinkHref(link: string): ParsedNoteLink | null {
  if (!link || typeof link !== "string") return null;
  try {
    // Avoid depending on browser URL in Vitest — manual parse.
    const m = link.match(
      /^zotero:\/\/note\/(u|\d+)\/([A-Z0-9]+)\/?(?:\?([^#]*))?(?:#(.*))?$/i,
    );
    if (!m) return null;
    const libraryToken = m[1];
    const noteKey = m[2];
    const query = m[3] || "";
    const hash = m[4] || "";
    const params = new URLSearchParams(query);
    const lineRaw = params.get("line");
    const lineIndex =
      lineRaw !== null && lineRaw !== ""
        ? Number.parseInt(lineRaw, 10)
        : undefined;
    return {
      libraryToken,
      noteKey,
      ignore: params.get("ignore") === "1" ? true : undefined,
      lineIndex:
        typeof lineIndex === "number" && Number.isFinite(lineIndex)
          ? lineIndex
          : undefined,
      sectionName: params.get("section") || undefined,
      selectionText: hash ? decodeURIComponent(hash) : undefined,
    };
  } catch {
    return null;
  }
}

function buildNoteLinkAnchorHtml(href: string, title: string): string {
  const label = escapeNoteLinkText(title.trim() || href);
  return `<p><a href="${escapeNoteLinkText(href)}">${label}</a></p>`;
}
