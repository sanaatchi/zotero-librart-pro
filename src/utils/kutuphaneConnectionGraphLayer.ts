// @ajan: cursor · @etiket: connection-map, kutuphane-graph, f8
import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  LayerKind,
  makeEdgeId,
} from "./connectionGraph";
import {
  fetchKutuphaneConnectionGraph,
  isKutuphaneGraphLayerEnabled,
} from "./kutuphaneSemanticBridge";
import type { KutuphaneConnectionGraphPayload } from "./kutuphaneSemanticParse";

export type KutuphaneGraphMeta = {
  generatedAt?: string;
  inScope: number;
  totalEdges: number;
  warns?: KutuphaneGraphWarn[];
};

export type KutuphaneGraphWarn =
  | { kind: "lowInScope" }
  | { kind: "stale"; days: number };

export {
  computeKutuphaneOfflineGraphEdges,
  isKutuphaneGraphLayerEnabled,
  edgesFromKutuphanePayload,
  evaluateKutuphaneGraphWarnings,
};

function mapOfflineLayer(layer: string): LayerKind {
  if (layer === "doi") return "citation";
  if (
    layer === "manual" ||
    layer === "tag" ||
    layer === "note" ||
    layer === "semantic"
  ) {
    return layer;
  }
  return "citation";
}

/**
 * Kutuphane offline kenarları → harita scope (yalnız mevcut düğümler).
 * Aynı edge id canlı katmanla birleşince dedup olur.
 */
function edgesFromKutuphanePayload(
  payload: KutuphaneConnectionGraphPayload,
  nodes: Map<number, GraphNode>,
): GraphEdge[] {
  const keyToId = new Map<string, number>();
  for (const node of nodes.values()) {
    keyToId.set(node.key.toUpperCase(), node.itemID);
  }

  const out: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const row of payload.edges ?? []) {
    const sourceId = keyToId.get(row.source.toUpperCase());
    const targetId = keyToId.get(row.target.toUpperCase());
    if (!sourceId || !targetId || sourceId === targetId) continue;
    if (!nodes.has(sourceId) || !nodes.has(targetId)) continue;

    const a = nodes.get(sourceId)!;
    const b = nodes.get(targetId)!;
    const source = Math.min(sourceId, targetId);
    const target = Math.max(sourceId, targetId);
    const layer = mapOfflineLayer(row.layer);
    const state = row.state === "suggested" ? "suggested" : "confirmed";
    const id =
      row.id ||
      makeEdgeId(
        layer,
        source,
        target,
        String(row.via?.doi ?? row.via?.tags ?? ""),
      );
    if (seen.has(id)) continue;
    seen.add(id);

    const edge: GraphEdge = {
      id,
      source,
      target,
      layer,
      state,
      confidence: row.confidence,
      crossDiscipline: isCrossDiscipline(a, b),
    };
    if (layer === "note") {
      edge.viaNoteSource = "kutuphane-offline";
    }
    if (layer === "citation" && row.layer === "doi" && row.via?.doi) {
      edge.citationSource = "crossref";
    }
    edge.kutuphaneOffline = true;
    out.push(edge);
  }
  return out;
}

const STALE_GRAPH_DAYS = 14;
const LOW_IN_SCOPE_MIN_TOTAL = 15;
const LOW_IN_SCOPE_RATIO = 0.12;

function evaluateKutuphaneGraphWarnings(
  meta: Pick<KutuphaneGraphMeta, "generatedAt" | "inScope" | "totalEdges">,
  nowMs: number = Date.now(),
): KutuphaneGraphWarn[] {
  const warns: KutuphaneGraphWarn[] = [];
  const { inScope, totalEdges, generatedAt } = meta;
  if (
    totalEdges >= LOW_IN_SCOPE_MIN_TOTAL &&
    inScope < totalEdges - 5 &&
    inScope < totalEdges * LOW_IN_SCOPE_RATIO
  ) {
    warns.push({ kind: "lowInScope" });
  }
  if (generatedAt) {
    const t = Date.parse(generatedAt);
    if (!Number.isNaN(t)) {
      const ageDays = Math.floor((nowMs - t) / 86_400_000);
      if (ageDays >= STALE_GRAPH_DAYS) {
        warns.push({ kind: "stale", days: ageDays });
      }
    }
  }
  return warns;
}

async function computeKutuphaneOfflineGraphEdges(
  nodes: Map<number, GraphNode>,
): Promise<{ edges: GraphEdge[]; meta: KutuphaneGraphMeta | null }> {
  if (!isKutuphaneGraphLayerEnabled() || nodes.size === 0) {
    return { edges: [], meta: null };
  }
  const payload = await fetchKutuphaneConnectionGraph();
  if (!payload?.edges?.length) return { edges: [], meta: null };
  const mapped = edgesFromKutuphanePayload(payload, nodes);
  const meta: KutuphaneGraphMeta = {
    generatedAt: payload.generatedAt,
    inScope: mapped.length,
    totalEdges: payload.edges.length,
  };
  meta.warns = evaluateKutuphaneGraphWarnings(meta);
  if (mapped.length) {
    ztoolkit.log(
      `Kutuphane offline graph: ${mapped.length} edges in scope (generated ${meta.generatedAt ?? "?"})`,
    );
  }
  return { edges: mapped, meta };
}
