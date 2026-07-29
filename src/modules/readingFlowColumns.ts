// @ajan: cursor · @etiket: f4, reading-flow, columns

import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  formatProgressLabel,
  formatRelativeDate,
  getDisplayProgress,
  inferStatus,
  ReadingStatus,
} from "../vendor/reading-flow/flowData";
import type { ReadingFlowStore } from "../vendor/reading-flow/readingFlowStore";

export { registerReadingFlowColumns, unregisterReadingFlowColumns };

const PROGRESS_KEY = "readingFlowProgress";
const STATUS_KEY = "readingFlowStatus";
const LAST_READ_KEY = "readingFlowLastRead";

let registeredKeys: string[] = [];

function statusLabel(status: ReadingStatus): string {
  return getString(`reading-status-${status}`);
}

function registerReadingFlowColumns(store: ReadingFlowStore) {
  try {
    const progressKey = Zotero.ItemTreeManager.registerColumn({
      dataKey: PROGRESS_KEY,
      label: getString("reading-column-progress"),
      pluginID: config.addonID,
      enabledTreeIDs: ["main"],
      zoteroPersist: ["width", "hidden", "sortDirection"],
      dataProvider: (item: Zotero.Item) => {
        if (!item?.isRegularItem?.()) return "";
        return formatProgressLabel(getDisplayProgress(store.getData(item)));
      },
      flex: 0,
      width: "72",
      showInColumnPicker: true,
    });

    const statusKey = Zotero.ItemTreeManager.registerColumn({
      dataKey: STATUS_KEY,
      label: getString("reading-column-status"),
      pluginID: config.addonID,
      enabledTreeIDs: ["main"],
      zoteroPersist: ["width", "hidden", "sortDirection"],
      dataProvider: (item: Zotero.Item) => {
        if (!item?.isRegularItem?.()) return "";
        return statusLabel(inferStatus(store.getData(item)));
      },
      flex: 0,
      width: "96",
      showInColumnPicker: true,
    });

    const lastReadKey = Zotero.ItemTreeManager.registerColumn({
      dataKey: LAST_READ_KEY,
      label: getString("reading-column-last-read"),
      pluginID: config.addonID,
      enabledTreeIDs: ["main"],
      zoteroPersist: ["width", "hidden", "sortDirection"],
      dataProvider: (item: Zotero.Item) => {
        if (!item?.isRegularItem?.()) return "";
        const lastReadAt = store.getData(item).lastReadAt;
        return lastReadAt ? formatRelativeDate(lastReadAt) : "";
      },
      flex: 0,
      width: "72",
      showInColumnPicker: true,
    });

    registeredKeys = [progressKey, statusKey, lastReadKey].filter(
      Boolean,
    ) as string[];
  } catch (e) {
    ztoolkit.log("Reading flow column registration failed", e);
  }
}

function unregisterReadingFlowColumns() {
  for (const dataKey of registeredKeys) {
    try {
      Zotero.ItemTreeManager.unregisterColumn(dataKey);
    } catch {
      // ignore
    }
  }
  registeredKeys = [];
}
