// @ajan: cursor · @etiket: f4, reading-flow, stats

import {
  getDisplayProgress,
  inferStatus,
  ReadingStatus,
} from "../vendor/reading-flow/flowData";
import type { ReadingFlowStore } from "../vendor/reading-flow/readingFlowStore";

export type ReadingFlowRow = {
  id: number;
  title: string;
  status: ReadingStatus;
  progress: number;
  lastReadAt: number | null;
};

export type ReadingFlowSnapshot = {
  libraryName: string;
  tracked: number;
  inProgress: number;
  read: number;
  byStatus: Record<ReadingStatus, number>;
  recent: ReadingFlowRow[];
  generatedAt: number;
};

export { buildReadingFlowSnapshot };

const EMPTY_STATUS: Record<ReadingStatus, number> = {
  "to-read": 0,
  reading: 0,
  skimmed: 0,
  read: 0,
  important: 0,
};

async function buildReadingFlowSnapshot(
  store: ReadingFlowStore,
): Promise<ReadingFlowSnapshot> {
  const libraryID = Zotero.Libraries.userLibraryID;
  const library = Zotero.Libraries.get(libraryID);
  const libraryName =
    library && typeof library === "object" && "name" in library
      ? String(library.name)
      : String(libraryID);
  const allItems = await Zotero.Items.getAll(libraryID);
  const byStatus = { ...EMPTY_STATUS };
  const rows: ReadingFlowRow[] = [];
  let inProgress = 0;
  let read = 0;

  for (const item of allItems) {
    if (!item?.isRegularItem()) continue;

    const data = store.getData(item);
    const hasTrack =
      store.hasReadingFlowData(item) ||
      data.s ||
      data.lastReadAt ||
      Object.keys(data.p).length > 0;
    if (!hasTrack) continue;

    const status = inferStatus(data);
    byStatus[status] += 1;
    const progress = getDisplayProgress(data);
    if (status === "reading" || status === "skimmed") inProgress += 1;
    if (status === "read" || status === "important") read += 1;

    rows.push({
      id: item.id,
      title: (item.getField("title") as string) || `#${item.id}`,
      status,
      progress,
      lastReadAt: data.lastReadAt,
    });
  }

  rows.sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0));

  return {
    libraryName,
    tracked: rows.length,
    inProgress,
    read,
    byStatus,
    recent: rows.slice(0, 60),
    generatedAt: Date.now(),
  };
}
