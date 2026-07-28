import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { isWindowAlive } from "../utils/window";
import { buildConnectionGraph, ConnectionGraph } from "../utils/connectionGraph";
import {
  computeSemanticSuggestions,
  isZotSeekReady,
  SemanticCacheEntry,
} from "../utils/connectionSemanticLayer";
import {
  computeNoteLayerEdges,
  computeHighlightSemanticEdges,
  promoteHighConfidenceNoteEdges,
} from "../utils/connectionNoteLayer";
import {
  registerConnectionMapNoteObserver,
  unregisterConnectionMapNoteObserver,
} from "../utils/connectionNotify";
import {
  renderConnectionMap,
  updateConnectionMapGraph,
  ConnectionMapLayerState,
} from "./connectionMapRenderer";

export { openConnectionMap, initConnectionMapWindow };

const MAP_ID = `${config.addonRef}-connection-map`;

async function openConnectionMap() {
  if (isWindowAlive(addon.data.connectionMap?.window)) {
    addon.data.connectionMap!.window!.focus();
    return;
  }

  const mainWin = Zotero.getMainWindow();
  if (!mainWin) return;

  const url = `chrome://${config.addonRef}/content/connection-map.xhtml`;
  const features =
    "chrome,centerscreen,resizable,dialog=no,width=1280,height=920";
  const win =
    (mainWin.openDialog(url, MAP_ID, features) as Window | null) ||
    (mainWin.open(url, MAP_ID, features) as Window | null);
  if (!win) return;

  if (!addon.data.connectionMap) {
    addon.data.connectionMap = {};
  }
  addon.data.connectionMap.window = win;
  if (!addon.data.connectionMap.semanticCache) {
    addon.data.connectionMap.semanticCache = new Map();
  }

  win.addEventListener("unload", () => {
    unregisterConnectionMapNoteObserver();
    if (addon.data.connectionMap?.window === win) {
      addon.data.connectionMap.window = undefined;
      addon.data.connectionMap.dismissedSemanticIds = undefined;
      addon.data.connectionMap.semanticCache = undefined;
    }
  });

  await waitForWindowLoad(win);
  // Let the dialog finish layout so canvas has non-zero size.
  await Zotero.Promise.delay(50);
  await initConnectionMapWindow(win);
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

async function initConnectionMapWindow(win: Window) {
  const doc = win.document;
  doc.title = getString("connection-map-title");

  const status = doc.getElementById(
    `${config.addonRef}-connection-map-status-text`,
  );
  if (status) status.textContent = getString("connection-map-loading");

  try {
    // 1) Fast path: tag + manual — paint immediately so the window is not blank.
    const base = await buildConnectionGraph(undefined, {
      includeTagLayer: true,
      includeManualLayer: true,
    });

    addon.data.connectionMap = {
      ...addon.data.connectionMap,
      window: win,
      lastGraph: base,
    };

    const layerState = readLayerState(doc);
    renderConnectionMap(win, base, layerState, {
      onRefresh: () => initConnectionMapWindow(win),
      zotSeekReady: isZotSeekReady(),
    });
    updateStatus(status, base);
    ztoolkit.log(
      `Connection Map base: ${base.nodes.size} nodes, ${base.edges.length} edges`,
    );

    try {
      registerConnectionMapNoteObserver(win, base.libraryID, () => {
        void initConnectionMapWindow(win);
      });
    } catch (e) {
      ztoolkit.log("Connection Map note observer register failed", e);
    }

    // 2) Background: note + semantic — merge and re-render when ready.
    void enrichGraphInBackground(win, base, status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const canvas = doc.getElementById(
      `${config.addonRef}-connection-map-canvas`,
    );
    if (canvas) {
      canvas.textContent = getString("connection-map-error", {
        args: { message: msg },
      });
    }
    if (status) status.textContent = "";
    ztoolkit.log("Connection Map failed", e);
  }
}

async function enrichGraphInBackground(
  win: Window,
  base: ConnectionGraph,
  status: Element | null,
) {
  if (!isWindowAlive(win)) return;
  try {
    const extra = await loadOptionalLayers(win, base, (msg) => {
      if (status && isWindowAlive(win)) status.textContent = msg;
    });
    if (!isWindowAlive(win)) return;
    if (!extra.length) {
      updateStatus(status, base);
      return;
    }

    const full = await buildConnectionGraph(base.libraryID, {
      includeTagLayer: true,
      includeManualLayer: true,
      extraEdges: extra,
    });
    if (!isWindowAlive(win) || addon.data.connectionMap?.window !== win) {
      return;
    }

    addon.data.connectionMap.lastGraph = full;
    updateConnectionMapGraph(win, full, readLayerState(win.document));
    updateStatus(status, full);
    ztoolkit.log(
      `Connection Map enriched: ${full.nodes.size} nodes, ${full.edges.length} edges`,
    );
  } catch (e) {
    ztoolkit.log("Connection Map background enrich failed", e);
    if (isWindowAlive(win)) updateStatus(status, base);
  }
}

async function loadOptionalLayers(
  win: Window,
  base: ConnectionGraph,
  onStatus: (msg: string) => void,
) {
  const extra: ConnectionGraph["edges"] = [];

  try {
    const noteEdges = await computeNoteLayerEdges(base.libraryID, base.nodes);
    try {
      await promoteHighConfidenceNoteEdges(noteEdges);
    } catch (e) {
      ztoolkit.log("Connection Map note promote failed", e);
    }
    extra.push(...noteEdges);

    const highlightEdges = await computeHighlightSemanticEdges(base.nodes);
    extra.push(...highlightEdges);
  } catch (e) {
    ztoolkit.log("Connection Map note layer failed (soft)", e);
  }

  try {
    if (isZotSeekReady()) {
      onStatus(getString("connection-map-loading") + " (ZotSeek…)");
      if (!addon.data.connectionMap) {
        addon.data.connectionMap = { window: win };
      }
      if (!addon.data.connectionMap.semanticCache) {
        addon.data.connectionMap.semanticCache = new Map<
          number,
          SemanticCacheEntry[]
        >();
      }
      if (!addon.data.connectionMap.dismissedSemanticIds) {
        addon.data.connectionMap.dismissedSemanticIds = new Set();
      }

      const relatedPairs = new Set<string>();
      for (const edge of base.edges) {
        if (edge.layer === "manual" && edge.state === "confirmed") {
          relatedPairs.add(
            `${Math.min(edge.source, edge.target)}::${Math.max(edge.source, edge.target)}`,
          );
        }
      }

      const semantic = await computeSemanticSuggestions(base.nodes, {
        cache: addon.data.connectionMap.semanticCache,
        dismissedIds: addon.data.connectionMap.dismissedSemanticIds,
        relatedPairs,
        maxQueries: 40,
        topK: 4,
        minSimilarity: 0.48,
        onProgress: (done, total) => {
          if (total > 0 && done % 5 === 0) {
            onStatus(
              getString("connection-map-semantic-progress", {
                args: { done, total },
              }),
            );
          }
        },
      });
      if (semantic.available) {
        extra.push(...semantic.edges);
      }
    }
  } catch (e) {
    ztoolkit.log("Connection Map semantic layer failed (soft)", e);
  }

  return extra;
}

function readLayerState(doc: Document): ConnectionMapLayerState {
  const checked = (id: string, fallback: boolean) => {
    const el = doc.getElementById(id) as HTMLInputElement | null;
    return el ? !!el.checked : fallback;
  };
  return {
    tag: checked(`${config.addonRef}-layer-tag`, true),
    manual: checked(`${config.addonRef}-layer-manual`, true),
    semantic: checked(`${config.addonRef}-layer-semantic`, true),
    note: checked(`${config.addonRef}-layer-note`, true),
  };
}

function updateStatus(
  status: Element | null,
  graph: ConnectionGraph,
) {
  if (!status) return;
  const confirmed = graph.edges.filter((e) => e.state === "confirmed").length;
  const suggested = graph.edges.filter((e) => e.state === "suggested").length;
  status.textContent = getString("connection-map-status-updated", {
    args: {
      library: graph.libraryName,
      time: new Date(graph.generatedAt).toLocaleString(),
      confirmed,
      suggested,
    },
  });
}
