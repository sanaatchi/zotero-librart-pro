import { foldTag, similarity } from "./tagAnalysis";
import {
  GraphEdge,
  GraphNode,
  LayerKind,
  isCrossDiscipline,
  makeEdgeId,
} from "./connectionGraph";
import { appendTimelineEntry } from "./connectionTimeline";

export {
  recordConfirmedConnection,
  confirmManualConnection,
  acceptSuggestedConnection,
  removeConnection,
  offerBridgeTag,
  findBridgeTagCandidate,
  areItemsRelated,
};

const BRIDGE_SIMILARITY_THRESHOLD = 0.72;

function areItemsRelated(itemA: Zotero.Item, itemB: Zotero.Item): boolean {
  if (itemA.id === itemB.id) return true;
  const related = itemA.relatedItems || [];
  return related.includes(itemB.key);
}

/**
 * Single funnel for all confirmed relation writes (layers B, C, D promotion).
 * Appends a timeline entry for v1.1 history filters.
 * Idempotent: already-related pairs are a no-op.
 */
async function recordConfirmedConnection(
  itemA: Zotero.Item,
  itemB: Zotero.Item,
  layer: LayerKind | "unknown" = "unknown",
): Promise<boolean> {
  if (itemA.id === itemB.id) return false;
  if (areItemsRelated(itemA, itemB)) return false;

  itemA.addRelatedItem(itemB);
  itemB.addRelatedItem(itemA);
  await itemA.saveTx({ skipSelect: true, skipNotifier: true });
  await itemB.saveTx({ skipSelect: true, skipNotifier: true });
  try {
    appendTimelineEntry(itemA, itemB, layer);
  } catch (e) {
    ztoolkit.log("Timeline append failed", e);
  }
  return true;
}

async function confirmManualConnection(
  itemA: Zotero.Item,
  itemB: Zotero.Item,
): Promise<boolean> {
  return recordConfirmedConnection(itemA, itemB, "manual");
}

async function acceptSuggestedConnection(edge: GraphEdge): Promise<boolean> {
  const itemA = Zotero.Items.get(edge.source);
  const itemB = Zotero.Items.get(edge.target);
  if (!itemA || !itemB) {
    throw new Error("Suggested connection items not found");
  }
  const layer =
    edge.layer === "note" || edge.layer === "semantic" ? edge.layer : "manual";
  return recordConfirmedConnection(itemA, itemB, layer);
}

async function removeConnection(
  itemA: Zotero.Item,
  itemB: Zotero.Item,
): Promise<void> {
  if (!areItemsRelated(itemA, itemB) && !areItemsRelated(itemB, itemA)) {
    return;
  }
  await itemA.removeRelatedItem(itemB);
  await itemB.removeRelatedItem(itemA);
  await itemA.saveTx({ skipSelect: true, skipNotifier: true });
  await itemB.saveTx({ skipSelect: true, skipNotifier: true });
}

/**
 * Propose a bridge tag for a cross-discipline pair, suppressing near-duplicates
 * of tags already on either item (foldTag + Dice similarity).
 */
function findBridgeTagCandidate(
  itemA: Zotero.Item,
  itemB: Zotero.Item,
  proposedTag: string,
): string | null {
  const tag = proposedTag.trim();
  if (!tag) return null;

  const foldedProposed = foldTag(tag);
  if (!foldedProposed) return null;

  const existing = [
    ...itemA.getTags().map((t) => t.tag),
    ...itemB.getTags().map((t) => t.tag),
  ];
  for (const name of existing) {
    const folded = foldTag(name);
    if (!folded) continue;
    if (folded === foldedProposed) return null;
    if (similarity(folded, foldedProposed) >= BRIDGE_SIMILARITY_THRESHOLD) {
      return null;
    }
  }
  return tag;
}

/**
 * If the pair is cross-discipline and a non-duplicate tag is proposed,
 * add it to both items. Returns true when a tag was written.
 */
async function offerBridgeTag(
  itemA: Zotero.Item,
  itemB: Zotero.Item,
  proposedTag: string,
  nodes?: Map<number, GraphNode>,
): Promise<boolean> {
  if (nodes) {
    const a = nodes.get(itemA.id);
    const b = nodes.get(itemB.id);
    if (a && b && !isCrossDiscipline(a, b)) return false;
  } else {
    // Without graph nodes, still require distinct top-level collection roots
    // when both items resolve — caller should pass nodes from the map.
  }

  const tag = findBridgeTagCandidate(itemA, itemB, proposedTag);
  if (!tag) return false;

  if (!itemA.hasTag(tag)) itemA.addTag(tag);
  if (!itemB.hasTag(tag)) itemB.addTag(tag);
  await itemA.saveTx({ skipSelect: true, skipNotifier: true });
  await itemB.saveTx({ skipSelect: true, skipNotifier: true });
  return true;
}

/** Helper for UI to build a transient confirmed-looking edge after accept. */
export function toConfirmedManualEdge(
  edge: GraphEdge,
  nodes: Map<number, GraphNode>,
): GraphEdge {
  const a = nodes.get(edge.source);
  const b = nodes.get(edge.target);
  return {
    id: makeEdgeId("manual", edge.source, edge.target, ""),
    source: Math.min(edge.source, edge.target),
    target: Math.max(edge.source, edge.target),
    layer: "manual",
    state: "confirmed",
    confidence: 1,
    crossDiscipline: a && b ? isCrossDiscipline(a, b) : edge.crossDiscipline,
  };
}
