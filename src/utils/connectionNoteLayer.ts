import { getPref } from "./prefs";
import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";
import { recordConfirmedConnection } from "./connectionActions";
import { isSemanticLayerReady, searchByText } from "./connectionSemanticLayer";

export {
  extractCitationSpansFromNote,
  extractBetterNotesWikilinks,
  extractSelectItemLinksFromNote,
  extractHighlightTextsFromNote,
  computeNoteLayerEdges,
  computeNoteLayerEdgesFromNotes,
  computeHighlightSemanticEdges,
  promoteHighConfidenceNoteEdges,
};

type NoteCitationHit = {
  targetItemID: number;
  noteID: number;
  source: "citation-span" | "better-notes-wikilink" | "highlight-semantic";
};

type HighlightSnippet = {
  noteID: number;
  sourceItemID: number;
  text: string;
};

/** BN/Zotero encode annotation & citation attrs with encodeURIComponent. */
function tryDecodeAttrJson(raw: string): any | null {
  if (!raw) return null;
  let s = raw
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  try {
    if (/%[0-9A-Fa-f]{2}/.test(s)) {
      s = decodeURIComponent(s);
    }
  } catch {
    // keep entity-decoded string
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Parse native Zotero note citation spans.
 * Attribute order varies — find spans that carry data-citation and a citation class.
 */
function extractCitationSpansFromNote(
  noteItem: Zotero.Item,
): NoteCitationHit[] {
  if (!noteItem.isNote()) return [];
  const html = noteItem.getNote() || "";
  const hits: NoteCitationHit[] = [];
  const re = /<span\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[1] || "";
    if (!/\bclass\s*=\s*"[^"]*\bcitation\b/i.test(attrs)) continue;
    const dataMatch = attrs.match(/\bdata-citation\s*=\s*"([^"]*)"/i);
    if (!dataMatch) continue;
    try {
      const data = tryDecodeAttrJson(dataMatch[1]);
      if (!data) continue;
      const items = Array.isArray(data?.citationItems)
        ? data.citationItems
        : Array.isArray(data)
          ? data
          : [];
      for (const ci of items) {
        const resolved = resolveCitationItem(ci, noteItem.libraryID);
        if (resolved) {
          hits.push({
            targetItemID: resolved,
            noteID: noteItem.id,
            source: "citation-span",
          });
        }
      }
    } catch {
      // Malformed citation payload — skip.
    }
  }
  return hits;
}

function resolveCitationItem(ci: any, libraryID: number): number | null {
  if (!ci) return null;

  const uris: string[] = ci.uris || ci.item?.uris || [];
  for (const uri of uris) {
    try {
      const itemID = Zotero.URI.getURIItemID(uri);
      if (!itemID) continue;
      const item = Zotero.Items.get(itemID);
      if (!item) continue;
      if (item.isRegularItem()) return item.id;
      if (item.parentItemID) {
        const parent = Zotero.Items.get(item.parentItemID);
        if (parent?.isRegularItem()) return parent.id;
      }
    } catch {
      // continue
    }
  }

  const key =
    ci.itemKey ||
    ci.key ||
    ci.item?.key ||
    (typeof ci.id === "string" ? ci.id : null);
  if (key) {
    const item = Zotero.Items.getByLibraryAndKey(libraryID, key);
    if (item && item.isRegularItem()) return item.id;
  }
  return null;
}

/**
 * Better Notes wikilinks appear as href="zotero://note/..." in note HTML.
 * Parse directly — do not call into Better Notes internals.
 */
function extractBetterNotesWikilinks(
  noteItem: Zotero.Item,
): NoteCitationHit[] {
  if (!noteItem.isNote()) return [];
  const html = noteItem.getNote() || "";
  const hits: NoteCitationHit[] = [];
  const re = /href="(zotero:\/\/note\/[^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const target = resolveNoteLink(match[1]);
    if (!target) continue;
    const targetParentID = target.parentItemID;
    const sourceParentID = noteItem.parentItemID;
    if (!targetParentID || !sourceParentID) continue;
    if (targetParentID === sourceParentID) continue;
    const targetParent = Zotero.Items.get(targetParentID);
    const sourceParent = Zotero.Items.get(sourceParentID);
    if (
      targetParent?.isRegularItem() &&
      sourceParent?.isRegularItem()
    ) {
      hits.push({
        targetItemID: targetParent.id,
        noteID: noteItem.id,
        source: "better-notes-wikilink",
      });
    }
  }
  return hits;
}

/**
 * Item select links sometimes appear in notes (Zotero / BN):
 *   zotero://select/library/items/KEY
 *   zotero://select/groups/123/items/KEY
 * Treat as citation-span-equivalent high confidence.
 */
function extractSelectItemLinksFromNote(
  noteItem: Zotero.Item,
): NoteCitationHit[] {
  if (!noteItem.isNote()) return [];
  const html = noteItem.getNote() || "";
  const hits: NoteCitationHit[] = [];
  const re =
    /href="zotero:\/\/select\/(?:library|groups\/\d+)\/items\/([A-Z0-9]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const key = match[1];
    const item =
      Zotero.Items.getByLibraryAndKey(noteItem.libraryID, key) ||
      Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, key);
    if (!item) continue;
    let targetID: number | null = null;
    if (item.isRegularItem()) targetID = item.id;
    else if (item.parentItemID) {
      const parent = Zotero.Items.get(item.parentItemID);
      if (parent?.isRegularItem()) targetID = parent.id;
    }
    if (!targetID) continue;
    hits.push({
      targetItemID: targetID,
      noteID: noteItem.id,
      source: "citation-span",
    });
  }
  return hits;
}

function resolveNoteLink(href: string): Zotero.Item | null {
  // BN forms:
  //   zotero://note/u/KEY/
  //   zotero://note/g/GROUPID/KEY/   (legacy / docs)
  //   zotero://note/{libraryId}/KEY/ (Better Notes actual group writer)
  // Optional ?line= / ?section= / #selection
  try {
    const m = href.match(
      /^zotero:\/\/note\/(?:u|g\/\d+|\d+)\/([A-Z0-9]+)/i,
    );
    if (!m) return null;
    const key = m[1];
    const userLib = Zotero.Libraries.userLibraryID;
    let item = Zotero.Items.getByLibraryAndKey(userLib, key);
    if (item && item.isNote()) return item;

    for (const lib of Zotero.Libraries.getAll()) {
      item = Zotero.Items.getByLibraryAndKey(lib.libraryID, key);
      if (item && item.isNote()) return item;
    }
  } catch {
    return null;
  }
  return null;
}

function citingItemID(noteItem: Zotero.Item): number | null {
  const parentID = noteItem.parentItemID;
  if (!parentID) return null;
  const parent = Zotero.Items.get(parentID);
  if (parent?.isRegularItem()) return parent.id;
  return null;
}

function collectHits(note: Zotero.Item): NoteCitationHit[] {
  return [
    ...extractCitationSpansFromNote(note),
    ...extractBetterNotesWikilinks(note),
    ...extractSelectItemLinksFromNote(note),
  ];
}

function hitsToEdges(
  notes: Zotero.Item[],
  nodes: Map<number, GraphNode>,
): GraphEdge[] {
  const pairMap = new Map<
    string,
    {
      a: number;
      b: number;
      noteID: number;
      source: NoteCitationHit["source"];
    }
  >();

  for (const note of notes) {
    if (!note.isNote() || note.deleted) continue;
    const sourceID = citingItemID(note);
    if (!sourceID || !nodes.has(sourceID)) continue;

    for (const hit of collectHits(note)) {
      if (!nodes.has(hit.targetItemID)) continue;
      if (hit.targetItemID === sourceID) continue;
      const a = Math.min(sourceID, hit.targetItemID);
      const b = Math.max(sourceID, hit.targetItemID);
      const key = `${a}::${b}::${hit.source}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, {
          a,
          b,
          noteID: hit.noteID,
          source: hit.source,
        });
      }
    }
  }

  const edges: GraphEdge[] = [];
  for (const pair of pairMap.values()) {
    const sourceNode = nodes.get(pair.a);
    const targetNode = nodes.get(pair.b);
    if (!sourceNode || !targetNode) continue;
    edges.push({
      id: makeEdgeId("note", pair.a, pair.b, String(pair.noteID)),
      source: pair.a,
      target: pair.b,
      layer: "note",
      state: "confirmed",
      confidence: 1,
      viaNoteID: pair.noteID,
      viaNoteSource:
        pair.source === "highlight-semantic"
          ? "highlight-semantic"
          : pair.source,
      crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
    });
  }
  return edges;
}

/** Full-library note scan (window open / refresh). */
async function computeNoteLayerEdges(
  libraryID: number,
  nodes: Map<number, GraphNode>,
): Promise<GraphEdge[]> {
  const allItems = await Zotero.Items.getAll(libraryID);
  const notes = allItems.filter((i) => i.isNote() && !i.deleted);
  return hitsToEdges(notes, nodes);
}

/** Incremental scan for Notifier-driven updates (changed notes only). */
function computeNoteLayerEdgesFromNotes(
  notes: Zotero.Item[],
  nodes: Map<number, GraphNode>,
): GraphEdge[] {
  return hitsToEdges(notes, nodes);
}

/**
 * Strip tags from highlight span inner HTML.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Better Notes / Zotero annotation highlights in note HTML:
 *   <span class="highlight|underline" data-annotation="...">text</span>
 */
function extractHighlightTextsFromNote(
  noteItem: Zotero.Item,
): HighlightSnippet[] {
  if (!noteItem.isNote()) return [];
  const sourceItemID = citingItemID(noteItem);
  if (!sourceItemID) return [];
  const html = noteItem.getNote() || "";
  const out: HighlightSnippet[] = [];
  const re = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[1] || "";
    const isHighlight =
      /\bclass\s*=\s*"[^"]*\b(highlight|underline)\b/i.test(attrs) &&
      /\bdata-annotation\s*=\s*"/i.test(attrs);
    if (!isHighlight) continue;
    const text = stripHtml(match[2] || "");
    if (text.length < 24) continue;
    out.push({ noteID: noteItem.id, sourceItemID, text });
  }
  return out;
}

/**
 * D(iii): highlighted passages → ZotSeek text search → suggested note edges.
 * Soft-fail when ZotSeek missing. Rate-limited. Never auto-promotes.
 */
async function computeHighlightSemanticEdges(
  nodes: Map<number, GraphNode>,
): Promise<GraphEdge[]> {
  const enabled = getPref("connectionMapEnableHighlightLayer");
  if (!enabled) return [];
  if (!(await isSemanticLayerReady())) return [];

  const MAX_HIGHLIGHTS_PER_NOTE = 3;
  const MAX_QUERIES = 24;
  const MAX_EDGES = 60;
  const TOP_K = 4;
  const MIN_SIM = 0.42;

  let libraryID = Zotero.Libraries.userLibraryID;
  for (const n of nodes.values()) {
    libraryID = n.libraryID;
    break;
  }

  let notes: Zotero.Item[] = [];
  try {
    const all = await Zotero.Items.getAll(libraryID);
    notes = all.filter((i) => i.isNote() && !i.deleted);
  } catch (e) {
    ztoolkit.log("Highlight scan failed to list notes", e);
    return [];
  }

  const snippets: HighlightSnippet[] = [];
  for (const note of notes) {
    const fromNote = extractHighlightTextsFromNote(note);
    snippets.push(...fromNote.slice(0, MAX_HIGHLIGHTS_PER_NOTE));
    if (snippets.length >= MAX_QUERIES) break;
  }
  const limited = snippets.slice(0, MAX_QUERIES);
  if (!limited.length) return [];

  const nodeIDSet = new Set(nodes.keys());
  const dismissed = addon.data.connectionMap?.dismissedSemanticIds;
  const pairBest = new Map<
    string,
    { a: number; b: number; score: number; noteID: number }
  >();

  for (let i = 0; i < limited.length; i++) {
    const snip = limited[i];
    if (!nodes.has(snip.sourceItemID)) continue;
    try {
      const hits = await searchByText(snip.text, {
        topK: TOP_K,
        minSimilarity: MIN_SIM,
        excludeItemIds: [snip.sourceItemID],
        libraryId: libraryID,
        nodeIDSet,
      });
      for (const hit of hits) {
        if (hit.itemId === snip.sourceItemID) continue;
        if (!nodes.has(hit.itemId)) continue;
        const a = Math.min(snip.sourceItemID, hit.itemId);
        const b = Math.max(snip.sourceItemID, hit.itemId);
        const edgeId = makeEdgeId("note", a, b, `hl-${snip.noteID}`);
        if (dismissed?.has(edgeId)) continue;
        const na = nodes.get(a)!;
        const nb = nodes.get(b)!;
        const cross = isCrossDiscipline(na, nb);
        const score = hit.similarity * (cross ? 1.08 : 1);
        const pk = `${a}::${b}`;
        const prev = pairBest.get(pk);
        if (!prev || score > prev.score) {
          pairBest.set(pk, { a, b, score, noteID: snip.noteID });
        }
      }
    } catch (e) {
      ztoolkit.log("Highlight→ZotSeek query failed", e);
    }
    if (i % 3 === 2) await Zotero.Promise.delay(0);
  }

  const ranked = [...pairBest.values()]
    .sort((p, q) => q.score - p.score)
    .slice(0, MAX_EDGES);

  const edges: GraphEdge[] = [];
  for (const pair of ranked) {
    const sourceNode = nodes.get(pair.a);
    const targetNode = nodes.get(pair.b);
    if (!sourceNode || !targetNode) continue;
    edges.push({
      id: makeEdgeId("note", pair.a, pair.b, `hl-${pair.noteID}`),
      source: pair.a,
      target: pair.b,
      layer: "note",
      state: "suggested",
      confidence: Math.max(0.2, Math.min(0.85, pair.score)),
      viaNoteID: pair.noteID,
      viaNoteSource: "highlight-semantic",
      crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
    });
  }
  return edges;
}

/**
 * Auto-promote high-confidence note edges (citation-span / BN wikilink)
 * to real relatedItem links. Idempotent if already related.
 */
async function promoteHighConfidenceNoteEdges(
  edges: GraphEdge[],
): Promise<number> {
  let promoted = 0;
  for (const edge of edges) {
    if (edge.layer !== "note") continue;
    if (
      edge.viaNoteSource !== "citation-span" &&
      edge.viaNoteSource !== "better-notes-wikilink"
    ) {
      continue;
    }
    const itemA = Zotero.Items.get(edge.source);
    const itemB = Zotero.Items.get(edge.target);
    if (!itemA || !itemB) continue;
    const wrote = await recordConfirmedConnection(itemA, itemB, "note");
    if (wrote) promoted++;
  }
  return promoted;
}
