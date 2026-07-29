import { getPref, setPref } from "./prefs";
import type { LayerKind } from "./connectionGraph";

export type TimelineEntry = {
  a: number;
  b: number;
  layer: LayerKind | "unknown";
  ts: string;
};

const PREF_KEY = "connectionMapTimelineJson";
const MAX_ENTRIES = 800;

export {
  appendTimelineEntry,
  loadTimeline,
  filterEdgesByTimelineDays,
  pairInTimelineSince,
};

function loadTimeline(): TimelineEntry[] {
  try {
    const raw = getPref(PREF_KEY);
    if (typeof raw !== "string" || !raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TimelineEntry[]) : [];
  } catch {
    return [];
  }
}

function saveTimeline(entries: TimelineEntry[]) {
  const trimmed = entries.slice(-MAX_ENTRIES);
  setPref(PREF_KEY, JSON.stringify(trimmed));
}

function appendTimelineEntry(
  itemA: Zotero.Item,
  itemB: Zotero.Item,
  layer: LayerKind | "unknown" = "unknown",
) {
  const entries = loadTimeline();
  entries.push({
    a: Math.min(itemA.id, itemB.id),
    b: Math.max(itemA.id, itemB.id),
    layer,
    ts: new Date().toISOString(),
  });
  saveTimeline(entries);
}

function pairInTimelineSince(
  a: number,
  b: number,
  sinceMs: number,
): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (const e of loadTimeline()) {
    if (e.a !== lo || e.b !== hi) continue;
    const t = Date.parse(e.ts);
    if (!Number.isNaN(t) && t >= sinceMs) return true;
  }
  return false;
}

/**
 * Keep auto layers; for manual/semantic/note confirmed edges require
 * a timeline hit within the window (or keep if no timeline data yet for pair
 * from before logging existed — tag edges always kept).
 */
function filterEdgesByTimelineDays<
  T extends { source: number; target: number; layer: string; state: string },
>(edges: T[], days: number): T[] {
  if (!days || days <= 0) return edges;
  const since = Date.now() - days * 86400000;
  const entries = loadTimeline();
  const recent = new Set(
    entries
      .filter((e) => {
        const t = Date.parse(e.ts);
        return !Number.isNaN(t) && t >= since;
      })
      .map((e) => `${e.a}::${e.b}`),
  );

  return edges.filter((e) => {
    if (e.layer === "tag") return true;
    if (e.state === "suggested") return true;
    const key = `${Math.min(e.source, e.target)}::${Math.max(e.source, e.target)}`;
    // If we have any timeline data for this pair in window, keep.
    if (recent.has(key)) return true;
    // Pre-timeline confirmed relations: keep manual so map isn't emptied.
    if (e.layer === "manual" && e.state === "confirmed") return true;
    // Note/semantic confirmed without recent log: hide when filter active.
    return false;
  });
}
