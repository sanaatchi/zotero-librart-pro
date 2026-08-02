// @ajan: cursor · @etiket: f4, reading-flow, bridge, opt-out

import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { isWindowAlive } from "../utils/window";
import { ReadingFlowStore } from "../vendor/reading-flow/readingFlowStore";
import {
  formatProgressLabel,
  formatRelativeDate,
  ReadingStatus,
} from "../vendor/reading-flow/flowData";
import { ReadingTracker } from "./readingTracker";
import {
  registerReadingFlowColumns,
  unregisterReadingFlowColumns,
} from "./readingFlowColumns";
import {
  buildReadingFlowSnapshot,
  ReadingFlowSnapshot,
} from "../utils/readingFlowStats";
import {
  buildReadingActivityIndex,
  ReadingActivityIndex,
} from "../utils/readingFlowMapFilter";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import { inferStatus } from "../vendor/reading-flow/flowData";

export {
  initReadingFlow,
  shutdownReadingFlow,
  readingFlowMenuChild,
  readingStatusMenuChild,
  openReadingDashboard,
  initReadingDashboardWindow,
  isReadingFlowEnabled,
  getReadingFlowStore,
  buildReadingIndexForGraph,
  setReadingStatusForSelected,
  resetReadingProgressForSelected,
};

const DASHBOARD_ID = `${config.addonRef}-reading-dashboard`;

let store: ReadingFlowStore | null = null;
let tracker: ReadingTracker | null = null;
let initialized = false;

function getReadingFlowStore(): ReadingFlowStore {
  if (!store) store = new ReadingFlowStore();
  return store;
}

/** Explicit opt-in only — never treat undefined as enabled. */
function isReadingFlowEnabled(): boolean {
  return getPref("reading.enabled") === true;
}

/**
 * Process-wide init — registers a single Zotero.Notifier observer and a
 * single set of ItemTreeManager columns. Idempotent: a second call (e.g. a
 * stray re-invocation from another window's lifecycle) is a no-op rather
 * than silently replacing the existing tracker/observer reference.
 */
function initReadingFlow() {
  if (!isReadingFlowEnabled()) return;
  if (initialized) return;
  initialized = true;
  const flowStore = getReadingFlowStore();
  registerReadingFlowColumns(flowStore);
  void ensureReadingColumnsVisibleOnFirstRun();
  tracker = new ReadingTracker(flowStore);
  tracker.register();
}

function shutdownReadingFlow() {
  if (!initialized) return;
  initialized = false;
  tracker?.unregister();
  tracker = null;
  unregisterReadingFlowColumns();
  store?.close();
  store = null;
}

function readingFlowMenuChild() {
  return {
    tag: "menuitem" as const,
    label: getString("menu-reading-dashboard"),
    commandListener: () => {
      void openReadingDashboard();
    },
  };
}

function readingStatusMenuChild() {
  const statuses: ReadingStatus[] = [
    "to-read",
    "reading",
    "skimmed",
    "read",
    "important",
  ];
  return {
    tag: "menu" as const,
    label: getString("menu-reading-status"),
    icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
    children: [
      ...statuses.map((status) => ({
        tag: "menuitem" as const,
        label: getString(`reading-status-${status}`),
        commandListener: async () => {
          await setReadingStatusForSelected(status);
        },
      })),
      {
        tag: "menuitem" as const,
        label: getString("menu-reading-status-clear"),
        commandListener: async () => {
          await setReadingStatusForSelected(null);
        },
      },
      {
        tag: "menuitem" as const,
        label: getString("menu-reading-status-reset-progress"),
        commandListener: async () => {
          await resetReadingProgressForSelected();
        },
      },
    ],
  };
}

async function setReadingStatusForSelected(status: ReadingStatus | null) {
  if (!isReadingFlowEnabled()) return;
  const items = getZoteroAdapter()
    .getActivePane()
    ?.getSelectedItems()
    ?.filter((i) => i.isRegularItem());
  if (!items?.length) return;
  const store = getReadingFlowStore();
  for (const item of items) {
    await store.setStatus(item, status);
  }
  Zotero.ItemTreeManager.refreshColumns?.();
}

async function resetReadingProgressForSelected() {
  if (!isReadingFlowEnabled()) return;
  const items = getZoteroAdapter()
    .getActivePane()
    ?.getSelectedItems()
    ?.filter((i) => i.isRegularItem());
  if (!items?.length) return;
  const store = getReadingFlowStore();
  for (const item of items) {
    await store.resetProgress(item);
  }
  Zotero.ItemTreeManager.refreshColumns?.();
}

function buildReadingIndexForGraph(
  nodeIds: number[],
): ReadingActivityIndex | undefined {
  if (!isReadingFlowEnabled()) return undefined;
  const store = getReadingFlowStore();
  return buildReadingActivityIndex(nodeIds, (id) => {
    const item = Zotero.Items.get(id);
    if (!item?.isRegularItem()) {
      return { lastReadAt: null, status: "to-read" as const };
    }
    const data = store.getData(item);
    return { lastReadAt: data.lastReadAt, status: inferStatus(data) };
  });
}

async function ensureReadingColumnsVisibleOnFirstRun() {
  if (getPref("reading.columnsInitialized")) return;
  const dataKeys = [
    "readingFlowProgress",
    "readingFlowStatus",
    "readingFlowLastRead",
  ];
  try {
    const itemsView = await waitForMainItemsView();
    if (!itemsView) return;
    await applyReadingColumnVisibility(itemsView, dataKeys);
    if (typeof itemsView._resetColumns === "function") {
      await itemsView._resetColumns();
    }
    await applyReadingColumnVisibility(itemsView, dataKeys);
    if (typeof itemsView._writeColumnPrefsToFile === "function") {
      await itemsView._writeColumnPrefsToFile(true);
    }
    setPref("reading.columnsInitialized", true);
  } catch (e) {
    ztoolkit.log("Reading columns first-run setup failed", e);
  }
}

async function waitForMainItemsView() {
  for (let attempt = 0; attempt < 120; attempt++) {
    const pane = Zotero.getActiveZoteroPane?.();
    const itemsView = pane?.itemsView as
      | {
          id?: string;
          _columnPrefs?: Record<string, { hidden?: boolean }>;
          _resetColumns?: () => Promise<void>;
          _writeColumnPrefsToFile?: (force?: boolean) => Promise<void>;
        }
      | undefined;
    if (itemsView?.id?.startsWith("item-tree-main-")) {
      return itemsView;
    }
    await delayMs(250);
  }
  return null;
}

async function applyReadingColumnVisibility(
  itemsView: {
    _columnPrefs?: Record<string, { hidden?: boolean }>;
  },
  dataKeys: string[],
) {
  if (!itemsView._columnPrefs) itemsView._columnPrefs = {};
  for (const dataKey of dataKeys) {
    for (const columnKey of getTreeColumnKeys(dataKey)) {
      itemsView._columnPrefs[columnKey] = {
        ...(itemsView._columnPrefs[columnKey] || {}),
        hidden: false,
      };
    }
  }
}

function getTreeColumnKeys(dataKey: string): string[] {
  const keys = new Set<string>([dataKey, `${config.addonID}-${dataKey}`]);
  return [...keys];
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const win = Zotero.getMainWindow?.();
    const schedule = win?.setTimeout?.bind(win) ?? globalThis.setTimeout;
    schedule(resolve, ms);
  });
}

async function openReadingDashboard() {
  if (!isReadingFlowEnabled()) return;
  if (isWindowAlive(addon.data.readingDashboard?.window)) {
    addon.data.readingDashboard!.window!.focus();
    return;
  }

  const mainWin = Zotero.getMainWindow();
  if (!mainWin) return;

  const url = `chrome://${config.addonRef}/content/reading-dashboard.xhtml`;
  const features =
    "chrome,centerscreen,resizable,dialog=no,width=920,height=680";
  const win =
    (mainWin.openDialog(url, DASHBOARD_ID, features) as Window | null) ||
    (mainWin.open(url, DASHBOARD_ID, features) as Window | null);
  if (!win) return;

  addon.data.readingDashboard = { window: win };
  win.addEventListener("unload", () => {
    if (addon.data.readingDashboard?.window === win) {
      addon.data.readingDashboard.window = undefined;
    }
  });

  await waitForWindowLoad(win);
  await initReadingDashboardWindow(win);
}

function waitForWindowLoad(win: Window): Promise<void> {
  return new Promise((resolve) => {
    if (win.document.readyState === "complete") {
      resolve();
      return;
    }
    win.addEventListener("load", () => resolve(), { once: true });
  });
}

async function initReadingDashboardWindow(win: Window) {
  const doc = win.document;
  doc.title = getString("reading-dashboard-title");
  const root = doc.getElementById(`${config.addonRef}-reading-root`);
  const status = doc.getElementById(`${config.addonRef}-reading-status`);
  if (!root) return;

  if (status) status.textContent = getString("reading-dashboard-loading");

  try {
    const snapshot = await buildReadingFlowSnapshot(getReadingFlowStore());
    root.innerHTML = renderDashboard(snapshot);
    if (status) {
      status.textContent = getString("reading-dashboard-updated", {
        args: {
          library: snapshot.libraryName,
          time: new Date(snapshot.generatedAt).toLocaleString(),
        },
      });
    }
    wireDashboardActions(win);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    root.innerHTML = `<div class="callout callout-warn">${escapeHtml(
      getString("reading-dashboard-error", { args: { message: msg } }),
    )}</div>`;
    if (status) status.textContent = "";
    ztoolkit.log("Reading dashboard failed", e);
  }
}

function wireDashboardActions(win: Window) {
  const doc = win.document;
  const refreshBtn = doc.getElementById(`${config.addonRef}-reading-refresh`);
  refreshBtn?.addEventListener("click", () => {
    void initReadingDashboardWindow(win);
  });

  doc.querySelectorAll("[data-item-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = Number((el as HTMLElement).dataset.itemId);
      if (!Number.isFinite(id)) return;
      focusItem(id);
    });
  });
}

function focusItem(itemID: number) {
  const zp = Zotero.getActiveZoteroPane?.();
  if (!zp) return;
  if (!Zotero.Items.get(itemID)) return;
  zp.selectItem(itemID);
}

function renderDashboard(snapshot: ReadingFlowSnapshot): string {
  const cards = [
    card(getString("reading-dashboard-tracked"), String(snapshot.tracked)),
    card(
      getString("reading-dashboard-in-progress"),
      String(snapshot.inProgress),
    ),
    card(getString("reading-dashboard-read"), String(snapshot.read)),
  ].join("");

  const statusRows = (
    ["to-read", "reading", "skimmed", "read", "important"] as ReadingStatus[]
  )
    .map(
      (status) =>
        `<tr><td>${escapeHtml(getString(`reading-status-${status}`))}</td><td class="num">${snapshot.byStatus[status]}</td></tr>`,
    )
    .join("");

  const recentRows = snapshot.recent
    .map((row) => {
      const progress = formatProgressLabel(row.progress) || "—";
      const lastRead = row.lastReadAt
        ? formatRelativeDate(row.lastReadAt)
        : "—";
      return `<tr class="clickable" data-item-id="${row.id}" title="${escapeHtml(getString("reading-dashboard-focus-item"))}">
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(getString(`reading-status-${row.status}`))}</td>
        <td class="num">${escapeHtml(progress)}</td>
        <td class="num">${escapeHtml(lastRead)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="cards">${cards}</div>
    <section class="panel">
      <h2>${escapeHtml(getString("reading-dashboard-by-status"))}</h2>
      <table class="table"><tbody>${statusRows}</tbody></table>
    </section>
    <section class="panel">
      <h2>${escapeHtml(getString("reading-dashboard-recent"))}</h2>
      <table class="table">
        <thead>
          <tr>
            <th>${escapeHtml(getString("reading-dashboard-col-title"))}</th>
            <th>${escapeHtml(getString("reading-column-status"))}</th>
            <th>${escapeHtml(getString("reading-column-progress"))}</th>
            <th>${escapeHtml(getString("reading-column-last-read"))}</th>
          </tr>
        </thead>
        <tbody>${recentRows || `<tr><td colspan="4">${escapeHtml(getString("reading-dashboard-empty"))}</td></tr>`}</tbody>
      </table>
    </section>
    <div class="actions">
      <button type="button" id="${config.addonRef}-reading-refresh">${escapeHtml(getString("reading-dashboard-refresh"))}</button>
    </div>
  `;
}

function card(label: string, value: string): string {
  return `<div class="card"><div class="card-label">${escapeHtml(label)}</div><div class="card-value">${escapeHtml(value)}</div></div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
