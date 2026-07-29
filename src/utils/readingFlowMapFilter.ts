// @ajan: cursor · @etiket: f4.1, reading-flow, connection-map
import type { GraphEdge } from "./connectionGraph";
import { ReadingStatus } from "../vendor/reading-flow/flowData";
import { filterEdgesByTimelineDays } from "./connectionTimeline";

export type ReadingMapFilter = "all" | "unread" | "reading" | "read";

export type ReadingActivityIndex = {
  lastReadAt: Map<number, number>;
  status: Map<number, ReadingStatus>;
};

export type UnreadHub = {
  itemID: number;
  title: string;
  degree: number;
};

export {
  buildReadingActivityIndex,
  itemReadSince,
  itemMatchesReadingFilter,
  filterEdgesForMapView,
  findUnreadHubs,
};

function buildReadingActivityIndex(
  itemIds: number[],
  lookup: (itemId: number) => {
    lastReadAt: number | null;
    status: ReadingStatus;
  },
): ReadingActivityIndex {
  const lastReadAt = new Map<number, number>();
  const status = new Map<number, ReadingStatus>();

  for (const id of itemIds) {
    const data = lookup(id);
    if (data.lastReadAt) lastReadAt.set(id, data.lastReadAt);
    status.set(id, data.status);
  }

  return { lastReadAt, status };
}

function itemReadSince(
  index: ReadingActivityIndex,
  itemId: number,
  sinceMs: number,
): boolean {
  const ts = index.lastReadAt.get(itemId);
  return typeof ts === "number" && ts >= sinceMs;
}

function itemMatchesReadingFilter(
  index: ReadingActivityIndex,
  itemId: number,
  filter: ReadingMapFilter,
): boolean {
  if (filter === "all") return true;
  const status = index.status.get(itemId) ?? "to-read";
  const readAt = index.lastReadAt.get(itemId);
  if (filter === "unread") {
    return status === "to-read" && !readAt;
  }
  if (filter === "reading") {
    return status === "reading" || status === "skimmed";
  }
  return status === "read" || status === "important";
}

function filterEdgesForMapView(
  edges: GraphEdge[],
  timelineDays: number,
  readingIndex: ReadingActivityIndex | undefined,
  readingFilter: ReadingMapFilter,
): GraphEdge[] {
  const keep = new Set(
    filterEdgesByTimelineDays(edges, timelineDays).map((e) => e.id),
  );

  if (timelineDays > 0 && readingIndex) {
    const since = Date.now() - timelineDays * 86400000;
    for (const e of edges) {
      if (keep.has(e.id)) continue;
      if (
        itemReadSince(readingIndex, e.source, since) ||
        itemReadSince(readingIndex, e.target, since)
      ) {
        keep.add(e.id);
      }
    }
  }

  let result = edges.filter((e) => keep.has(e.id));

  if (readingFilter !== "all" && readingIndex) {
    result = result.filter(
      (e) =>
        itemMatchesReadingFilter(readingIndex, e.source, readingFilter) &&
        itemMatchesReadingFilter(readingIndex, e.target, readingFilter),
    );
  }

  return result;
}

function findUnreadHubs(
  nodes: Map<number, { title: string }>,
  edges: GraphEdge[],
  index: ReadingActivityIndex,
  options: { minDegree?: number; maxResults?: number } = {},
): UnreadHub[] {
  const minDegree = options.minDegree ?? 4;
  const maxResults = options.maxResults ?? 3;
  const degree = new Map<number, number>();

  for (const e of edges) {
    if (e.state !== "confirmed") continue;
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }

  const hubs: UnreadHub[] = [];
  for (const [itemID, node] of nodes) {
    const d = degree.get(itemID) || 0;
    if (d < minDegree) continue;
    if (!itemMatchesReadingFilter(index, itemID, "unread")) continue;
    hubs.push({ itemID, title: node.title, degree: d });
  }

  return hubs.sort((a, b) => b.degree - a.degree).slice(0, maxResults);
}
