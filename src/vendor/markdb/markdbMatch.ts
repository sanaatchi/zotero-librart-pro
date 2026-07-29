// @ajan: cursor · @etiket: f8, markdb, vendor, match
// Build item↔item edge candidates from MarkDB vault notes (MIT-inspired).

import type { MarkdbEdgeCandidate, MarkdbParsedNote } from "./markdbTypes";

export type MarkdbIdMaps = {
  citekeyToItemId: Map<string, number>;
  itemKeyToItemId: Map<string, number>;
};

export {
  resolvePrimaryItemId,
  buildMarkdbEdgeCandidates,
  extractCitationKeyFromExtra,
};

function extractCitationKeyFromExtra(extra: string): string | null {
  if (!extra) return null;
  const m = extra.match(/^(?:Citation Key|citekey):\s*(\S+)/im);
  return m?.[1]?.trim() || null;
}

function resolvePrimaryItemId(
  note: MarkdbParsedNote,
  maps: MarkdbIdMaps,
): number | null {
  if (note.primaryItemKey) {
    const id = maps.itemKeyToItemId.get(note.primaryItemKey.toUpperCase());
    if (id) return id;
  }
  if (note.primaryCitekey) {
    const id = maps.citekeyToItemId.get(note.primaryCitekey.toLowerCase());
    if (id) return id;
  }
  return null;
}

function buildMarkdbEdgeCandidates(
  notes: MarkdbParsedNote[],
  maps: MarkdbIdMaps,
): MarkdbEdgeCandidate[] {
  const pairs = new Map<string, MarkdbEdgeCandidate>();

  for (const note of notes) {
    const sourceId = resolvePrimaryItemId(note, maps);
    if (!sourceId) continue;

    const targets = new Set<number>();
    for (const ck of note.refCitekeys) {
      const id = maps.citekeyToItemId.get(ck.toLowerCase());
      if (id && id !== sourceId) targets.add(id);
    }
    for (const key of note.refItemKeys) {
      const id = maps.itemKeyToItemId.get(key.toUpperCase());
      if (id && id !== sourceId) targets.add(id);
    }

    for (const targetId of targets) {
      const a = Math.min(sourceId, targetId);
      const b = Math.max(sourceId, targetId);
      const pk = `${a}::${b}`;
      if (pairs.has(pk)) continue;
      pairs.set(pk, {
        sourceItemId: a,
        targetItemId: b,
        viaPath: note.path,
        confidence: 0.9,
      });
    }
  }

  return [...pairs.values()];
}
