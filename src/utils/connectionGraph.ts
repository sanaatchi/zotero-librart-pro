// @ajan: cursor · @etiket: connection-graph, f8, markdb, perf-merge
import { computeTagLayerEdges } from "./connectionTagLayer";
import { attachDisciplineProfile } from "./connectionDiscipline";
import { annotateBridgeScores } from "./connectionBridgeScore";

export type LayerKind = "tag" | "manual" | "semantic" | "note" | "citation";
export type ConnectionState = "confirmed" | "suggested";

export type DisciplineProfile = {
  primary: string;
  scores: Record<string, number>;
  source: "collection" | "tags" | "embedding" | "openlibrary";
};

export type GraphNode = {
  itemID: number;
  key: string;
  libraryID: number;
  title: string;
  creatorSummary: string;
  itemType: string;
  year?: number;
  disciplineIDs: number[];
  disciplineLabels: string[];
  /** Soft discipline classification (v1.1). */
  disciplineProfile?: DisciplineProfile;
  tagCount: number;
  /** Distinct cross-discipline neighbors (v1.1 bridge score). */
  bridgeScore?: number;
};

export type CitationSource = "crossref" | "openalex" | "opencitations";

export type GraphEdge = {
  id: string;
  source: number;
  target: number;
  layer: LayerKind;
  state: ConnectionState;
  confidence: number;
  viaTags?: string[];
  viaNoteID?: number;
  viaNoteSource?:
    | "citation-span"
    | "better-notes-wikilink"
    | "highlight-semantic"
    | "markdb-vault"
    | "kutuphane-offline";
  /** F5 — which citation API produced this edge (citation layer only). */
  citationSource?: CitationSource;
  /** Kutuphane offline graph (`/connection-graph`) — F2 toggle. */
  kutuphaneOffline?: boolean;
  crossDiscipline: boolean;
  createdAt?: string;
};

export type ConnectionGraph = {
  libraryID: number;
  libraryName: string;
  nodes: Map<number, GraphNode>;
  edges: GraphEdge[];
  generatedAt: string;
};

export type BuildConnectionGraphOptions = {
  includeTagLayer?: boolean;
  includeManualLayer?: boolean;
  extraEdges?: GraphEdge[];
  /** When set, only these regular items become nodes (scoped map). */
  itemIDs?: number[];
};

/** Sentinel discipline for items not in any top-level collection. */
export const UNSORTED_DISCIPLINE_ID = -1;
export const UNSORTED_DISCIPLINE_LABEL = "Unsorted";

export {
  buildConnectionGraph,
  mergeExtraEdgesIntoGraph,
  getNodeDisciplineKey,
  makeEdgeId,
  isCrossDiscipline,
  buildGraphNode,
};

/**
 * Single accessor for discipline identity. v1.1 can prefer
 * `disciplineProfile.primary` here without touching the renderer.
 */
function getNodeDisciplineKey(node: GraphNode): string {
  if (node.disciplineProfile?.primary) {
    return node.disciplineProfile.primary;
  }
  return [...node.disciplineIDs].sort((a, b) => a - b).join(",");
}

function makeEdgeId(
  layer: LayerKind,
  source: number,
  target: number,
  via: string = "",
): string {
  const a = Math.min(source, target);
  const b = Math.max(source, target);
  return [layer, a, b, via].join("::");
}

function isOnlyUnsorted(node: GraphNode): boolean {
  return (
    node.disciplineIDs.length === 1 &&
    node.disciplineIDs[0] === UNSORTED_DISCIPLINE_ID
  );
}

function isCrossDiscipline(a: GraphNode, b: GraphNode): boolean {
  // Prefer soft discipline profiles when both sides have a primary.
  if (a.disciplineProfile?.primary && b.disciplineProfile?.primary) {
    const ka = a.disciplineProfile.primary;
    const kb = b.disciplineProfile.primary;
    if (ka === UNSORTED_DISCIPLINE_LABEL || kb === UNSORTED_DISCIPLINE_LABEL) {
      return false;
    }
    return ka !== kb;
  }

  // Unsorted is not a discipline — never highlight as a "bridge".
  if (isOnlyUnsorted(a) || isOnlyUnsorted(b)) return false;

  const bSet = new Set(b.disciplineIDs);
  for (const id of a.disciplineIDs) {
    if (bSet.has(id)) return false;
  }
  return true;
}

function creatorSummary(item: Zotero.Item): string {
  const creators = item.getCreators();
  if (!creators.length) return "";
  const first = creators[0];
  const name =
    first.lastName ||
    [first.firstName, first.lastName].filter(Boolean).join(" ") ||
    "";
  if (creators.length === 1) return name;
  return `${name} et al.`;
}

function yearOf(item: Zotero.Item): number | undefined {
  const raw = item.getField("year") || item.getField("date") || "";
  const m = String(raw).match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : undefined;
}

/**
 * Resolve top-level collection membership as the v1 discipline heuristic.
 * Walks up parents so nested-collection items inherit the root collection.
 */
function resolveDisciplines(item: Zotero.Item): {
  ids: number[];
  labels: string[];
} {
  const seen = new Set<number>();
  const ids: number[] = [];
  const labels: string[] = [];

  for (const collID of item.getCollections()) {
    let coll = Zotero.Collections.get(collID) as Zotero.Collection | false;
    if (!coll) continue;
    while (coll.parentID) {
      const parent = Zotero.Collections.get(coll.parentID) as
        | Zotero.Collection
        | false;
      if (!parent) break;
      coll = parent;
    }
    if (seen.has(coll.id)) continue;
    seen.add(coll.id);
    ids.push(coll.id);
    labels.push(coll.name);
  }

  if (!ids.length) {
    return {
      ids: [UNSORTED_DISCIPLINE_ID],
      labels: [UNSORTED_DISCIPLINE_LABEL],
    };
  }
  return { ids, labels };
}

function buildGraphNode(item: Zotero.Item): GraphNode {
  const { ids, labels } = resolveDisciplines(item);
  const node: GraphNode = {
    itemID: item.id,
    key: item.key,
    libraryID: item.libraryID,
    title: item.getDisplayTitle() || item.getField("title") || item.key,
    creatorSummary: creatorSummary(item),
    itemType: item.itemType,
    year: yearOf(item),
    disciplineIDs: ids,
    disciplineLabels: labels,
    tagCount: item.getTags().length,
  };
  attachDisciplineProfile(node, item);
  return node;
}

function buildManualEdges(
  items: Zotero.Item[],
  nodes: Map<number, GraphNode>,
): GraphEdge[] {
  const keyToID = new Map<string, number>();
  for (const item of items) {
    keyToID.set(item.key, item.id);
  }

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const item of items) {
    const related = item.relatedItems || [];
    for (const relatedKey of related) {
      const targetID = keyToID.get(relatedKey);
      if (!targetID || targetID === item.id) continue;
      const id = makeEdgeId("manual", item.id, targetID, "");
      if (seen.has(id)) continue;
      seen.add(id);

      const sourceNode = nodes.get(item.id);
      const targetNode = nodes.get(targetID);
      if (!sourceNode || !targetNode) continue;

      edges.push({
        id,
        source: Math.min(item.id, targetID),
        target: Math.max(item.id, targetID),
        layer: "manual",
        state: "confirmed",
        confidence: 1,
        crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
      });
    }
  }
  return edges;
}

async function buildConnectionGraph(
  libraryID?: number,
  options: BuildConnectionGraphOptions = {},
): Promise<ConnectionGraph> {
  const {
    includeTagLayer = true,
    includeManualLayer = true,
    extraEdges = [],
    itemIDs,
  } = options;

  libraryID = libraryID ?? Zotero.Libraries.userLibraryID;
  const library = Zotero.Libraries.get(libraryID);
  const libraryName =
    library && typeof library === "object" && "name" in library
      ? String((library as { name?: string }).name || libraryID)
      : String(libraryID);

  let items: Zotero.Item[];
  if (itemIDs && itemIDs.length) {
    items = Zotero.Items.get(itemIDs).filter((item): item is Zotero.Item =>
      Boolean(item && item.isRegularItem() && !item.deleted),
    );
  } else {
    const allItems = await Zotero.Items.getAll(libraryID);
    items = allItems.filter((item) => item.isRegularItem() && !item.deleted);
  }

  const nodes = new Map<number, GraphNode>();
  for (const item of items) {
    nodes.set(item.id, buildGraphNode(item));
  }

  const edges: GraphEdge[] = [];

  if (includeTagLayer) {
    edges.push(...computeTagLayerEdges(items, nodes));
  }

  if (includeManualLayer) {
    edges.push(...buildManualEdges(items, nodes));
  }

  // Deduplicate by edge id — later layers (extraEdges) win on collision.
  const byId = new Map<string, GraphEdge>();
  for (const edge of edges) {
    byId.set(edge.id, edge);
  }
  for (const edge of extraEdges) {
    const pairManualId = makeEdgeId("manual", edge.source, edge.target, "");
    // Suggested edges that already have a confirmed relation: skip.
    if (edge.state === "suggested" && byId.has(pairManualId)) continue;
    // After D auto-promote, manual relatedItem already represents the pair —
    // drop redundant confirmed note edges for the same endpoints.
    if (
      edge.layer === "note" &&
      edge.state === "confirmed" &&
      byId.has(pairManualId)
    ) {
      continue;
    }
    byId.set(edge.id, edge);
  }

  const merged = [...byId.values()];
  annotateBridgeScores(nodes, merged);

  return {
    libraryID,
    libraryName,
    nodes,
    edges: merged,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Merge optional-layer edges into an existing graph without a second
 * `Items.getAll` (enrich path). Same collision rules as buildConnectionGraph.
 */
function mergeExtraEdgesIntoGraph(
  graph: ConnectionGraph,
  extraEdges: GraphEdge[],
): ConnectionGraph {
  if (!extraEdges.length) return graph;
  const byId = new Map<string, GraphEdge>();
  for (const edge of graph.edges) {
    byId.set(edge.id, edge);
  }
  for (const edge of extraEdges) {
    const pairManualId = makeEdgeId("manual", edge.source, edge.target, "");
    if (edge.state === "suggested" && byId.has(pairManualId)) continue;
    if (
      edge.layer === "note" &&
      edge.state === "confirmed" &&
      byId.has(pairManualId)
    ) {
      continue;
    }
    byId.set(edge.id, edge);
  }
  const merged = [...byId.values()];
  annotateBridgeScores(graph.nodes, merged);
  return {
    ...graph,
    edges: merged,
    generatedAt: new Date().toISOString(),
  };
}
