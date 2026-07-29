// @ajan: cursor · @etiket: f8.2.2, better-notes, related-notes
// Related-note discovery helpers (sibling + outbound wikilinks).
// Inspired by Better Notes relation concepts (AGPL-3.0) — no UI chrome ported.

import { parseNoteLinkHref } from "./link";

export type RelatedNoteKind = "sibling" | "outbound";

export type RelatedNoteCandidate = {
  noteKey: string;
  kind: RelatedNoteKind;
};

export { extractOutboundNoteKeysFromHtml, mergeRelatedNoteCandidates };

function extractOutboundNoteKeysFromHtml(html: string): string[] {
  const keys = new Set<string>();
  const re = /href="(zotero:\/\/note\/[^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html || ""))) {
    const parsed = parseNoteLinkHref(match[1]);
    if (parsed?.noteKey) keys.add(parsed.noteKey.toUpperCase());
  }
  return [...keys];
}

/**
 * Merge sibling note keys and outbound wikilink keys; source excluded; outbound
 * does not duplicate a sibling already listed.
 */
function mergeRelatedNoteCandidates(
  sourceKey: string,
  siblingKeys: string[],
  outboundKeys: string[],
): RelatedNoteCandidate[] {
  const source = (sourceKey || "").toUpperCase();
  const out: RelatedNoteCandidate[] = [];
  const seen = new Set<string>();

  for (const raw of siblingKeys) {
    const key = (raw || "").toUpperCase();
    if (!key || key === source || seen.has(key)) continue;
    seen.add(key);
    out.push({ noteKey: key, kind: "sibling" });
  }
  for (const raw of outboundKeys) {
    const key = (raw || "").toUpperCase();
    if (!key || key === source || seen.has(key)) continue;
    seen.add(key);
    out.push({ noteKey: key, kind: "outbound" });
  }
  return out;
}
