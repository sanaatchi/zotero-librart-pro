// @ajan: cursor · @etiket: connection-map, renderer, offline-semantic-ui
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  ConnectionGraph,
  GraphEdge,
  GraphNode,
} from "../utils/connectionGraph";
import {
  confirmManualConnection,
  acceptSuggestedConnection,
  findBridgeTagCandidate,
  offerBridgeTag,
  areItemsRelated,
  removeConnection,
} from "../utils/connectionActions";
import { updateHint } from "../utils/hint";
import {
  getNodeDisciplineKey,
  isCrossDiscipline,
} from "../utils/connectionGraph";
import {
  filterEdgesForMapView,
  itemMatchesReadingFilter,
  itemReadSince,
  ReadingMapFilter,
} from "../utils/readingFlowMapFilter";
import { buildReadingIndexForGraph } from "./readingFlowBridge";
import {
  exportConnectionMapPng,
  exportConnectionMapSvg,
} from "../utils/connectionExport";
import {
  isSemanticLayerReady,
  searchByText,
} from "../utils/connectionSemanticLayer";
import { isKutuphaneGraphLayerEnabled } from "../utils/kutuphaneSemanticBridge";

export type ConnectionMapLayerState = {
  tag: boolean;
  manual: boolean;
  semantic: boolean;
  note: boolean;
  citation: boolean;
  openalex: boolean;
  opencitations: boolean;
  kutuphane: boolean;
};

export type RenderCallbacks = {
  onRefresh: () => void | Promise<void>;
  zotSeekReady: boolean;
};

type SimNode = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  node: GraphNode;
  /** Bound on mount — paint uses this instead of querySelector. */
  el?: SVGGElement | null;
};

type RopePoint = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type SimEdge = {
  edge: GraphEdge;
  source: SimNode;
  target: SimNode;
  /** Free points along the thread — lag behind endpoints so the link bends. */
  mids: [RopePoint, RopePoint];
  /** Bound on mount — paint uses this instead of querySelector. */
  el?: SVGPathElement | null;
};

type RendererState = {
  simNodes: SimNode[];
  simEdges: SimEdge[];
  transform: { x: number; y: number; k: number };
  raf: number | null;
  connectMode: boolean;
  connectFirst: number | null;
  dragging: SimNode | null;
  dragMoved: boolean;
  dragStart: { x: number; y: number } | null;
  panning: boolean;
  panLast: { x: number; y: number } | null;
  spaceHeld: boolean;
  activePointerId: number | null;
  energy: number;
  viewSize: { w: number; h: number };
  /** Nodes excluded from force simulation — user-fixed position. */
  pinned: Set<number>;
  /** Multi-selected nodes (Ctrl/Cmd+click) for bulk actions. */
  selected: Set<number>;
  /** Shift+drag-to-connect gesture source, if active. */
  shiftConnectFrom: SimNode | null;
  shiftConnectLine: SVGLineElement | null;
  /** Node currently under the pointer during connect-mode pick / shift-drag. */
  hoverTargetId: number | null;
  contextMenuEl: HTMLDivElement | null;
};

const stateByWin = new WeakMap<Window, RendererState>();

export {
  renderConnectionMap,
  updateConnectionMapGraph,
  edgeStyle,
  updateKutuphaneGraphLayerUI,
  updateZotSeekUI,
  ensureOfflineSemanticLayerVisible,
};

function updateKutuphaneGraphLayerUI(win: Window) {
  const doc = win.document;
  const wrap = doc.getElementById(`${config.addonRef}-layer-kutuphane-wrap`);
  const enabled = isKutuphaneGraphLayerEnabled();
  if (wrap) {
    (wrap as HTMLElement).style.display = enabled ? "" : "none";
  }
  if (!enabled) {
    const el = doc.getElementById(
      `${config.addonRef}-layer-kutuphane`,
    ) as HTMLInputElement | null;
    if (el) el.checked = false;
  }
}

/** FAISS hazır olmasa da offline pairwise semantic kenarlar görünsün. */
function ensureOfflineSemanticLayerVisible(
  win: Window,
  graph: ConnectionGraph,
): void {
  const hasOfflineSemantic = graph.edges.some(
    (e) => e.kutuphaneOffline && e.layer === "semantic",
  );
  if (!hasOfflineSemantic) return;
  updateZotSeekUI(win, true, { preferChecked: true });
}

function edgeStyle(edge: GraphEdge): {
  stroke: string;
  width: number;
  dash: string;
  opacity: number;
} {
  if (edge.kutuphaneOffline) {
    return {
      stroke: "var(--map-edge-kutuphane)",
      width: edge.state === "suggested" ? 1.2 : 1.6,
      dash: edge.state === "suggested" ? "4 3" : "2 2",
      opacity: edge.state === "suggested" ? 0.6 : 0.8,
    };
  }
  if (edge.crossDiscipline) {
    return {
      stroke: "var(--map-bridge)",
      width: edge.state === "suggested" ? 1.6 : 2.2,
      dash: edge.state === "suggested" ? "5 4" : "",
      opacity: 0.95,
    };
  }
  const colors: Record<GraphEdge["layer"], string> = {
    tag: "var(--map-edge-tag)",
    manual: "var(--map-edge-manual)",
    semantic: "var(--map-edge-semantic)",
    note: "var(--map-edge-note)",
    citation: "var(--map-edge-citation)",
  };
  return {
    stroke: colors[edge.layer],
    width: edge.state === "suggested" ? 1.2 : 1.6,
    dash: edge.state === "suggested" ? "4 3" : "",
    opacity: edge.state === "suggested" ? 0.55 : 0.75,
  };
}

function renderConnectionMap(
  win: Window,
  graph: ConnectionGraph,
  layerState: ConnectionMapLayerState,
  callbacks: RenderCallbacks,
) {
  const doc = win.document;
  wireChrome(win, graph, callbacks);
  updateZotSeekUI(win, callbacks.zotSeekReady);
  buildSimulation(win, graph, layerState);
  startLoop(win);
}

function updateConnectionMapGraph(
  win: Window,
  graph: ConnectionGraph,
  layerState: ConnectionMapLayerState,
) {
  const prev = stateByWin.get(win);
  const oldPos = new Map<number, { x: number; y: number }>();
  if (prev) {
    for (const n of prev.simNodes) {
      oldPos.set(n.id, { x: n.x, y: n.y });
    }
    if (prev.raf != null) win.cancelAnimationFrame(prev.raf);
  }
  buildSimulation(win, graph, layerState, oldPos);
  startLoop(win);
}

function wireChrome(
  win: Window,
  graph: ConnectionGraph,
  callbacks: RenderCallbacks,
) {
  const doc = win.document;
  const title = doc.getElementById(`${config.addonRef}-connection-map-title`);
  if (title) title.textContent = getString("connection-map-title");

  const subtitle = doc.getElementById(
    `${config.addonRef}-connection-map-subtitle`,
  );
  if (subtitle) {
    subtitle.textContent = getString("connection-map-subtitle", {
      args: {
        library: graph.libraryName,
        items: graph.nodes.size,
        edges: graph.edges.length,
      },
    });
  }

  const hint = doc.getElementById(`${config.addonRef}-connection-map-hint`);
  if (hint) {
    hint.textContent = getString("connection-map-controls-hint");
  }

  const refreshBtn = doc.getElementById(
    `${config.addonRef}-connection-map-refresh`,
  ) as HTMLButtonElement | null;
  if (refreshBtn) {
    refreshBtn.textContent = getString("connection-map-refresh");
    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      try {
        // Clear semantic session cache on explicit refresh.
        // Keep dismissed ids so Yoksay survives refresh within the window session.
        if (addon.data.connectionMap?.semanticCache) {
          addon.data.connectionMap.semanticCache.clear();
        }
        await callbacks.onRefresh();
      } finally {
        refreshBtn.disabled = false;
      }
    };
  }

  const connectBtn = doc.getElementById(
    `${config.addonRef}-connection-map-connect`,
  ) as HTMLButtonElement | null;
  if (connectBtn) {
    connectBtn.textContent = getString("connection-map-connect-mode");
    connectBtn.onclick = () => {
      const st = stateByWin.get(win);
      if (!st) return;
      st.connectMode = !st.connectMode;
      st.connectFirst = null;
      connectBtn.classList.toggle("active", st.connectMode);
      setConnectHint(win, st);
      paintNodeStates(win);
    };
  }

  for (const layer of [
    "tag",
    "manual",
    "semantic",
    "note",
    "citation",
    "openalex",
    "opencitations",
    "kutuphane",
  ] as const) {
    const el = doc.getElementById(
      `${config.addonRef}-layer-${layer}`,
    ) as HTMLInputElement | null;
    const label = doc.querySelector(
      `label[for="${config.addonRef}-layer-${layer}"] span`,
    );
    if (label) {
      label.textContent = getString(`connection-map-layer-${layer}`);
    }
    // Assign once (overwrite) — avoid stacked listeners on refresh.
    if (el) {
      el.onchange = () => refilterFromCache(win);
    }
  }

  const filter = doc.getElementById(
    `${config.addonRef}-connection-map-filter`,
  ) as HTMLInputElement | null;
  if (filter) {
    filter.placeholder = getString("connection-map-filter-placeholder");
    filter.oninput = () => refilterFromCache(win);
  }

  const timeline = doc.getElementById(
    `${config.addonRef}-connection-map-timeline`,
  ) as HTMLSelectElement | null;
  if (timeline) {
    const opt0 = timeline.options[0];
    const opt1 = timeline.options[1];
    const opt2 = timeline.options[2];
    if (opt0) opt0.text = getString("connection-map-timeline-all");
    if (opt1) opt1.text = getString("connection-map-timeline-30");
    if (opt2) opt2.text = getString("connection-map-timeline-90");
    timeline.onchange = () => refilterFromCache(win);
  }

  const readingFilter = doc.getElementById(
    `${config.addonRef}-connection-map-reading`,
  ) as HTMLSelectElement | null;
  if (readingFilter) {
    const opts = [
      ["all", "connection-map-reading-all"],
      ["unread", "connection-map-reading-unread"],
      ["reading", "connection-map-reading-in-progress"],
      ["read", "connection-map-reading-read"],
    ] as const;
    for (let i = 0; i < opts.length; i++) {
      const opt = readingFilter.options[i];
      if (opt) opt.text = getString(opts[i][1]);
    }
    readingFilter.onchange = () => refilterFromCache(win);
  }

  const exportSvgBtn = doc.getElementById(
    `${config.addonRef}-connection-map-export-svg`,
  ) as HTMLButtonElement | null;
  if (exportSvgBtn) {
    exportSvgBtn.textContent = getString("connection-map-export-svg");
    exportSvgBtn.onclick = () => {
      if (exportConnectionMapSvg(win)) {
        updateHint(getString("connection-map-export-done"));
      }
    };
  }
  const exportPngBtn = doc.getElementById(
    `${config.addonRef}-connection-map-export-png`,
  ) as HTMLButtonElement | null;
  if (exportPngBtn) {
    exportPngBtn.textContent = getString("connection-map-export-png");
    exportPngBtn.onclick = () => {
      if (exportConnectionMapPng(win)) {
        updateHint(getString("connection-map-export-done"));
      }
    };
  }

  const connectSelectedBtn = doc.getElementById(
    `${config.addonRef}-connection-map-connect-selected`,
  ) as HTMLButtonElement | null;
  if (connectSelectedBtn) {
    connectSelectedBtn.onclick = async () => {
      const st = stateByWin.get(win);
      if (!st) return;
      await connectSelected(win, st, graph);
    };
  }

  wireDraftSearch(win, graph);
}

function wireDraftSearch(win: Window, graph: ConnectionGraph) {
  const doc = win.document;
  const input = doc.getElementById(
    `${config.addonRef}-connection-map-draft`,
  ) as HTMLInputElement | null;
  const btn = doc.getElementById(
    `${config.addonRef}-connection-map-draft-search`,
  ) as HTMLButtonElement | null;
  const results = doc.getElementById(
    `${config.addonRef}-connection-map-draft-results`,
  );
  if (!input || !btn || !results) return;

  input.placeholder = getString("connection-map-draft-placeholder");
  btn.textContent = getString("connection-map-draft-search");

  btn.onclick = async () => {
    const q = (input.value || "").trim();
    results.textContent = "";
    results.classList.remove("open");
    if (!q) return;

    if (!(await isSemanticLayerReady())) {
      results.textContent = getString("connection-map-zotseek-missing");
      results.classList.add("open");
      return;
    }

    btn.disabled = true;
    results.textContent = getString("connection-map-draft-searching");
    results.classList.add("open");
    try {
      const hits = await searchByText(q, {
        topK: 8,
        minSimilarity: 0.25,
        libraryId: graph.libraryID,
        nodeIDSet: new Set(graph.nodes.keys()),
        allowOutsideGraph: false,
      });
      results.textContent = "";
      if (!hits.length) {
        results.textContent = getString("connection-map-draft-empty");
        return;
      }
      for (const hit of hits) {
        const node = graph.nodes.get(hit.itemId);
        const row = doc.createElement("div");
        row.className = "draft-hit";
        const label = doc.createElement("span");
        let title = node?.title || hit.title || "";
        if (!title) {
          const item = Zotero.Items.get(hit.itemId);
          title = item ? item.getDisplayTitle() : String(hit.itemId);
        }
        label.textContent = `${title} · ${Math.round(hit.similarity * 100)}%`;
        row.appendChild(label);

        const selectBtn = doc.createElement("button");
        selectBtn.type = "button";
        selectBtn.className = "btn";
        selectBtn.textContent = getString("connection-map-draft-select");
        selectBtn.onclick = () => {
          try {
            Zotero.getActiveZoteroPane()?.selectItem(hit.itemId);
          } catch (e) {
            ztoolkit.log("draft select failed", e);
          }
        };
        row.appendChild(selectBtn);

        const bindBtn = doc.createElement("button");
        bindBtn.type = "button";
        bindBtn.className = "btn";
        bindBtn.textContent = getString("connection-map-draft-bind");
        bindBtn.onclick = async () => {
          const selected =
            Zotero.getActiveZoteroPane()?.getSelectedItems?.(false);
          const seed = selected?.find((it) => it.isRegularItem?.());
          if (!seed) {
            updateHint(getString("connection-map-connect-pick-first"));
            return;
          }
          const target = Zotero.Items.get(hit.itemId);
          if (!target) return;
          const wrote = await confirmManualConnection(seed, target);
          if (wrote) {
            updateHint(getString("connection-map-connect-done"));
            const refreshBtn = doc.getElementById(
              `${config.addonRef}-connection-map-refresh`,
            ) as HTMLButtonElement | null;
            refreshBtn?.click();
          } else {
            updateHint(getString("connection-map-already-related"));
          }
        };
        row.appendChild(bindBtn);
        results.appendChild(row);
      }
    } catch (e) {
      ztoolkit.log("Draft search failed", e);
      results.textContent = getString("connection-map-draft-error");
    } finally {
      btn.disabled = false;
    }
  };
}

/** Layer/filter change: re-render from cached graph (no recompute). */
function refilterFromCache(win: Window) {
  const graph = addon.data.connectionMap?.lastGraph;
  if (!graph) return;
  const doc = win.document;
  const checked = (id: string, fallback: boolean) => {
    const el = doc.getElementById(id) as HTMLInputElement | null;
    return el ? !!el.checked : fallback;
  };
  updateConnectionMapGraph(win, graph, {
    tag: checked(`${config.addonRef}-layer-tag`, true),
    manual: checked(`${config.addonRef}-layer-manual`, true),
    semantic: checked(`${config.addonRef}-layer-semantic`, true),
    note: checked(`${config.addonRef}-layer-note`, true),
    citation: checked(`${config.addonRef}-layer-citation`, true),
    openalex: checked(`${config.addonRef}-layer-openalex`, true),
    opencitations: checked(`${config.addonRef}-layer-opencitations`, true),
    kutuphane: checked(`${config.addonRef}-layer-kutuphane`, true),
  });
}

function setConnectHint(win: Window, st: RendererState) {
  const hint = win.document.getElementById(
    `${config.addonRef}-connection-map-hint`,
  );
  if (!hint) return;
  if (!st.connectMode) {
    hint.textContent = getString("connection-map-controls-hint");
    return;
  }
  if (st.connectFirst == null) {
    hint.textContent = getString("connection-map-connect-pick-first");
  } else {
    hint.textContent = getString("connection-map-connect-pick-second");
  }
}

/**
 * Repaints per-node stroke/dash to reflect connect-pick, shift-drag hover
 * target, multi-select, and pin state. Precedence: active connect/shift
 * source > hover target (while picking) > selected > pinned > default.
 */
function paintNodeStates(win: Window) {
  const st = stateByWin.get(win);
  const canvas = win.document.getElementById(
    `${config.addonRef}-connection-map-canvas`,
  );
  if (!st || !canvas) return;
  const picking =
    (st.connectMode && st.connectFirst != null) || !!st.shiftConnectFrom;
  canvas.querySelectorAll("g[data-node-id] circle").forEach((el) => {
    const circle = el as SVGCircleElement;
    const g = circle.parentElement;
    const id = Number(g?.getAttribute("data-node-id"));
    const isSource =
      (st.connectMode && st.connectFirst === id) ||
      st.shiftConnectFrom?.id === id;
    const isHoverTarget = picking && st.hoverTargetId === id && !isSource;
    const isSelected = st.selected.has(id);
    const isPinned = st.pinned.has(id);

    if (isSource) {
      circle.setAttribute("stroke", "var(--map-bridge)");
      circle.setAttribute("stroke-width", "2.5");
      circle.removeAttribute("stroke-dasharray");
    } else if (isHoverTarget) {
      circle.setAttribute("stroke", "var(--map-edge-note)");
      circle.setAttribute("stroke-width", "2.5");
      circle.removeAttribute("stroke-dasharray");
    } else if (isSelected) {
      circle.setAttribute("stroke", "var(--map-accent)");
      circle.setAttribute("stroke-width", "2.2");
      circle.removeAttribute("stroke-dasharray");
    } else if (isPinned) {
      circle.setAttribute("stroke", "var(--map-node-stroke)");
      circle.setAttribute("stroke-width", "2");
      circle.setAttribute("stroke-dasharray", "2 2");
    } else {
      circle.setAttribute("stroke", "var(--map-node-stroke)");
      circle.setAttribute("stroke-width", "1.25");
      circle.removeAttribute("stroke-dasharray");
    }
  });
}

function updateZotSeekUI(
  win: Window,
  ready: boolean,
  opts?: { preferChecked?: boolean },
) {
  const doc = win.document;
  const semanticWrap = doc.getElementById(
    `${config.addonRef}-layer-semantic-wrap`,
  );
  const missing = doc.getElementById(`${config.addonRef}-zotseek-missing`);
  if (semanticWrap) {
    (semanticWrap as HTMLElement).style.display = ready ? "" : "none";
  }
  if (missing) {
    missing.textContent = getString("connection-map-zotseek-missing");
    (missing as HTMLElement).style.display = ready ? "none" : "";
  }
  const el = doc.getElementById(
    `${config.addonRef}-layer-semantic`,
  ) as HTMLInputElement | null;
  if (!ready) {
    if (el) el.checked = false;
  } else if (opts?.preferChecked && el) {
    el.checked = true;
  }
}

function visibleEdges(
  graph: ConnectionGraph,
  layerState: ConnectionMapLayerState,
  timelineDays = 0,
  readingFilter: ReadingMapFilter = "all",
): GraphEdge[] {
  const layered = graph.edges.filter((e) => {
    if (e.kutuphaneOffline && !layerState.kutuphane) return false;
    if (e.layer === "tag" && !layerState.tag) return false;
    if (e.layer === "manual" && !layerState.manual) return false;
    if (e.layer === "semantic" && !layerState.semantic) return false;
    if (e.layer === "note" && !layerState.note) return false;
    if (e.layer === "citation") {
      const src = e.citationSource || "crossref";
      if (src === "openalex") return layerState.openalex;
      if (src === "opencitations") return layerState.opencitations;
      return layerState.citation;
    }
    return true;
  });
  const readingIndex = buildReadingIndexForGraph([...graph.nodes.keys()]);
  return filterEdgesForMapView(
    layered,
    timelineDays,
    readingIndex,
    readingFilter,
  );
}

function buildSimulation(
  win: Window,
  graph: ConnectionGraph,
  layerState: ConnectionMapLayerState,
  oldPos?: Map<number, { x: number; y: number }>,
) {
  const doc = win.document;
  const canvas = doc.getElementById(`${config.addonRef}-connection-map-canvas`);
  if (!canvas) return;

  const filterEl = doc.getElementById(
    `${config.addonRef}-connection-map-filter`,
  ) as HTMLInputElement | null;
  const filter = (filterEl?.value || "").trim().toLocaleLowerCase("tr");
  const timelineEl = doc.getElementById(
    `${config.addonRef}-connection-map-timeline`,
  ) as HTMLSelectElement | null;
  const timelineDays = Number(timelineEl?.value || "0") || 0;
  const readingEl = doc.getElementById(
    `${config.addonRef}-connection-map-reading`,
  ) as HTMLSelectElement | null;
  const readingFilter = (readingEl?.value || "all") as ReadingMapFilter;
  const readingIndex = buildReadingIndexForGraph([...graph.nodes.keys()]);

  const edges = visibleEdges(graph, layerState, timelineDays, readingFilter);
  const nodeIDs = new Set<number>();
  for (const e of edges) {
    nodeIDs.add(e.source);
    nodeIDs.add(e.target);
  }

  if (timelineDays > 0 && readingIndex) {
    const since = Date.now() - timelineDays * 86400000;
    for (const id of graph.nodes.keys()) {
      if (itemReadSince(readingIndex, id, since)) nodeIDs.add(id);
    }
  }

  const MAX_ISOLATE_NODES = 200;
  const needIsolates = nodeIDs.size < 8 || edges.length === 0;
  if (filter) {
    for (const [id, node] of graph.nodes) {
      const hay =
        `${node.title} ${node.creatorSummary} ${node.disciplineLabels.join(" ")} ${node.disciplineProfile?.primary || ""}`.toLocaleLowerCase(
          "tr",
        );
      if (hay.includes(filter)) nodeIDs.add(id);
    }
  } else if (needIsolates) {
    let added = 0;
    for (const id of graph.nodes.keys()) {
      if (nodeIDs.has(id)) continue;
      if (
        readingFilter !== "all" &&
        readingIndex &&
        !itemMatchesReadingFilter(readingIndex, id, readingFilter)
      ) {
        continue;
      }
      nodeIDs.add(id);
      added++;
      if (nodeIDs.size >= MAX_ISOLATE_NODES) break;
      if (added >= MAX_ISOLATE_NODES) break;
    }
  }

  if (readingFilter !== "all" && readingIndex) {
    for (const id of [...nodeIDs]) {
      if (!itemMatchesReadingFilter(readingIndex, id, readingFilter)) {
        nodeIDs.delete(id);
      }
    }
  }

  // Prefer measured size; fall back to window size (chrome dialogs often
  // report clientHeight=0 on first paint).
  const canvasEl = canvas as HTMLElement;
  const w = Math.max(
    canvasEl.clientWidth || 0,
    Math.floor((win.innerWidth || 1280) * 0.95),
    400,
  );
  const h = Math.max(
    canvasEl.clientHeight || 0,
    Math.floor((win.innerHeight || 920) * 0.7),
    300,
  );
  const cx = w / 2;
  const cy = h / 2;

  const simNodes: SimNode[] = [];
  const byId = new Map<number, SimNode>();
  let i = 0;
  const n = nodeIDs.size || 1;
  for (const id of nodeIDs) {
    const node = graph.nodes.get(id);
    if (!node) continue;
    const angle = (2 * Math.PI * i) / n;
    const radius = Math.min(w, h) * 0.35;
    const prev = oldPos?.get(id);
    const sn: SimNode = {
      id,
      x: prev?.x ?? cx + Math.cos(angle) * radius,
      y: prev?.y ?? cy + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      node,
    };
    simNodes.push(sn);
    byId.set(id, sn);
    i++;
  }

  const simEdges: SimEdge[] = [];
  for (const edge of edges) {
    const s = byId.get(edge.source);
    const t = byId.get(edge.target);
    if (!s || !t) continue;
    if (filter) {
      const hayS = `${s.node.title} ${s.node.creatorSummary}`.toLocaleLowerCase(
        "tr",
      );
      const hayT = `${t.node.title} ${t.node.creatorSummary}`.toLocaleLowerCase(
        "tr",
      );
      if (!hayS.includes(filter) && !hayT.includes(filter)) continue;
    }
    simEdges.push({
      edge,
      source: s,
      target: t,
      mids: initRopeMids(s, t),
    });
  }

  const prev = stateByWin.get(win);
  const st: RendererState = {
    simNodes,
    simEdges,
    transform: prev?.transform ?? { x: 0, y: 0, k: 1 },
    raf: null,
    connectMode: prev?.connectMode ?? false,
    connectFirst: prev?.connectFirst ?? null,
    dragging: null,
    dragMoved: false,
    dragStart: null,
    panning: false,
    panLast: null,
    spaceHeld: prev?.spaceHeld ?? false,
    activePointerId: null,
    energy: 1,
    viewSize: { w, h },
    pinned: new Set([...(prev?.pinned ?? [])].filter((id) => nodeIDs.has(id))),
    selected: new Set(
      [...(prev?.selected ?? [])].filter((id) => nodeIDs.has(id)),
    ),
    shiftConnectFrom: null,
    shiftConnectLine: null,
    hoverTargetId: null,
    contextMenuEl: null,
  };
  stateByWin.set(win, st);

  mountSvg(win, canvas, st, graph, w, h);
  const connectBtn = doc.getElementById(
    `${config.addonRef}-connection-map-connect`,
  );
  connectBtn?.classList.toggle("active", st.connectMode);
  setConnectHint(win, st);
}

function mountSvg(
  win: Window,
  canvas: Element,
  st: RendererState,
  graph: ConnectionGraph,
  w: number,
  h: number,
) {
  const doc = win.document;
  canvas.textContent = "";

  if (!st.simNodes.length) {
    const empty = doc.createElement("div");
    empty.style.cssText =
      "display:flex;align-items:center;justify-content:center;height:100%;color:var(--map-muted);padding:24px;text-align:center;";
    empty.textContent = getString("connection-map-empty");
    canvas.appendChild(empty);
    return;
  }

  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.style.touchAction = "none";
  svg.style.minHeight = `${h}px`;
  const root = doc.createElementNS("http://www.w3.org/2000/svg", "g");
  root.setAttribute("class", "map-root");
  applyTransform(root, st.transform);

  const edgeLayer = doc.createElementNS("http://www.w3.org/2000/svg", "g");
  edgeLayer.setAttribute("class", "edges");
  const nodeLayer = doc.createElementNS("http://www.w3.org/2000/svg", "g");
  nodeLayer.setAttribute("class", "nodes");

  for (const se of st.simEdges) {
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("data-edge-id", se.edge.id);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("d", ropePathD(se));
    const style = edgeStyle(se.edge);
    path.setAttribute("stroke", style.stroke);
    path.setAttribute("stroke-width", String(style.width));
    path.setAttribute("stroke-opacity", String(style.opacity));
    if (style.dash) path.setAttribute("stroke-dasharray", style.dash);
    path.style.cursor =
      se.edge.state === "suggested" || se.edge.layer === "manual"
        ? "pointer"
        : "default";

    const title = doc.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = edgeTooltip(se.edge, se.source.node, se.target.node);
    path.appendChild(title);
    se.el = path;

    if (se.edge.state === "suggested") {
      path.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const pct = Math.round(se.edge.confidence * 100);
        const acceptMsg = getString("connection-map-accept-confirm", {
          args: {
            a: se.source.node.title,
            b: se.target.node.title,
            pct,
          },
        });
        // OK = accept; Cancel = dismiss for this session.
        if (win.confirm(acceptMsg)) {
          const wrote = await acceptSuggestedConnection(se.edge);
          if (wrote) {
            updateHint(getString("connection-map-connect-done"));
            const manualToggle = doc.getElementById(
              `${config.addonRef}-layer-manual`,
            ) as HTMLInputElement | null;
            if (manualToggle) manualToggle.checked = true;
          } else {
            updateHint(getString("connection-map-already-related"));
          }
        } else {
          if (!addon.data.connectionMap) {
            addon.data.connectionMap = {};
          }
          if (!addon.data.connectionMap.dismissedSemanticIds) {
            addon.data.connectionMap.dismissedSemanticIds = new Set();
          }
          addon.data.connectionMap.dismissedSemanticIds.add(se.edge.id);
          updateHint(getString("connection-map-dismiss-suggestion"));
          // Drop from current view without full recompute.
          const graph = addon.data.connectionMap.lastGraph;
          if (graph) {
            graph.edges = graph.edges.filter((e) => e.id !== se.edge.id);
            refilterFromCache(win);
            return;
          }
        }
        const refreshBtn = doc.getElementById(
          `${config.addonRef}-connection-map-refresh`,
        ) as HTMLButtonElement | null;
        refreshBtn?.click();
      });
    }

    if (se.edge.layer === "manual" && se.edge.state === "confirmed") {
      path.addEventListener("contextmenu", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const msg = getString("connection-map-confirm-remove", {
          args: {
            a: se.source.node.title,
            b: se.target.node.title,
          },
        });
        if (!win.confirm(msg)) return;
        const itemA = Zotero.Items.get(se.edge.source);
        const itemB = Zotero.Items.get(se.edge.target);
        if (!itemA || !itemB) return;
        await removeConnection(itemA, itemB);
        updateHint(getString("connection-map-remove-done"));
        const refreshBtn = doc.getElementById(
          `${config.addonRef}-connection-map-refresh`,
        ) as HTMLButtonElement | null;
        refreshBtn?.click();
      });
    }
    edgeLayer.appendChild(path);
  }

  // Precompute degree so hub labels stay readable in dense graphs.
  const degreeById = new Map<number, number>();
  for (const sn of st.simNodes) degreeById.set(sn.id, 0);
  for (const se of st.simEdges) {
    degreeById.set(se.source.id, (degreeById.get(se.source.id) || 0) + 1);
    degreeById.set(se.target.id, (degreeById.get(se.target.id) || 0) + 1);
  }
  const hubIds = new Set(
    [...degreeById.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 36)
      .map(([id]) => id),
  );

  for (const sn of st.simNodes) {
    const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("data-node-id", String(sn.id));
    g.style.cursor = "pointer";

    const degree = degreeById.get(sn.id) || 0;
    const bridge = sn.node.bridgeScore || 0;
    const r = Math.min(
      18,
      5 + Math.sqrt(degree + sn.node.tagCount) * 1.1 + bridge * 1.35,
    );

    const circle = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", String(r));
    circle.setAttribute("fill", "var(--map-node)");
    circle.setAttribute("stroke", "var(--map-node-stroke)");
    circle.setAttribute("stroke-width", "1.25");

    const tip = doc.createElementNS("http://www.w3.org/2000/svg", "title");
    tip.textContent = [
      sn.node.title,
      sn.node.creatorSummary,
      sn.node.year ? String(sn.node.year) : "",
      sn.node.disciplineProfile?.primary || sn.node.disciplineLabels.join(", "),
      getNodeDisciplineKey(sn.node),
      sn.node.bridgeScore
        ? getString("connection-map-node-bridge-score", {
            args: { score: sn.node.bridgeScore },
          })
        : "",
    ]
      .filter(Boolean)
      .join(" · ");

    g.appendChild(tip);
    g.appendChild(circle);

    // Labels counter-scale with zoom so on-screen size stays constant (vector UX).
    const labelWrap = doc.createElementNS("http://www.w3.org/2000/svg", "g");
    labelWrap.setAttribute("class", "node-label-wrap");
    labelWrap.setAttribute("data-anchor-r", String(r));

    const label = doc.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "0");
    label.setAttribute("y", "12");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "node-label");
    label.setAttribute("data-hub", hubIds.has(sn.id) ? "1" : "0");
    label.textContent = truncate(sn.node.title, 28);
    labelWrap.appendChild(label);
    g.appendChild(labelWrap);

    g.addEventListener("pointerenter", () => {
      label.style.display = "";
      const picking =
        (st.connectMode &&
          st.connectFirst != null &&
          st.connectFirst !== sn.id) ||
        (!!st.shiftConnectFrom && st.shiftConnectFrom.id !== sn.id);
      if (picking) {
        st.hoverTargetId = sn.id;
        paintNodeStates(win);
      }
    });
    g.addEventListener("pointerleave", () => {
      syncOneLabel(label, st.transform.k);
      if (st.hoverTargetId === sn.id) {
        st.hoverTargetId = null;
        paintNodeStates(win);
      }
    });

    g.addEventListener("pointerdown", (ev) => {
      const pe = ev as PointerEvent;
      if (pe.button !== 0) return;
      pe.stopPropagation();
      pe.preventDefault();
      try {
        svg.setPointerCapture(pe.pointerId);
      } catch {
        /* ignore */
      }
      st.activePointerId = pe.pointerId;

      // Shift+drag: draw a rubber-band line and connect on release over
      // another node — faster than toggling "connect mode" for one link.
      if (pe.shiftKey && !st.connectMode) {
        st.shiftConnectFrom = sn;
        const line = ensureShiftLine(win, root);
        line.setAttribute("x1", String(sn.x));
        line.setAttribute("y1", String(sn.y));
        line.setAttribute("x2", String(sn.x));
        line.setAttribute("y2", String(sn.y));
        paintNodeStates(win);
        return;
      }

      st.dragging = sn;
      st.dragMoved = false;
      st.dragStart = { x: pe.clientX, y: pe.clientY };
      st.energy = 1;
      svg.classList.add("is-dragging-node");
    });

    g.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      // Ignore click that followed a node drag.
      if (st.dragMoved) {
        st.dragMoved = false;
        return;
      }
      const me = ev as MouseEvent;
      if (me.ctrlKey || me.metaKey) {
        toggleSelect(win, st, sn.id);
        return;
      }
      if (st.connectMode) {
        await handleConnectClick(win, st, sn, graph);
        return;
      }
      try {
        const pane = Zotero.getActiveZoteroPane();
        pane?.selectItem(sn.id);
      } catch (e) {
        ztoolkit.log("selectItem failed", e);
      }
    });

    g.addEventListener("dblclick", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      togglePin(win, st, sn.id);
    });

    g.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const me = ev as MouseEvent;
      showNodeContextMenu(win, st, sn, me.clientX, me.clientY);
    });

    sn.el = g;
    nodeLayer.appendChild(g);
  }

  root.appendChild(edgeLayer);
  root.appendChild(nodeLayer);
  svg.appendChild(root);
  canvas.appendChild(svg);
  paintNodeStates(win);
  applyViewport(root, svg, st.transform);
  wireViewportControls(win, svg, root, st, graph);
}

async function handleConnectClick(
  win: Window,
  st: RendererState,
  sn: SimNode,
  graph: ConnectionGraph,
) {
  if (st.connectFirst == null) {
    st.connectFirst = sn.id;
    setConnectHint(win, st);
    paintNodeStates(win);
    return;
  }
  if (st.connectFirst === sn.id) {
    st.connectFirst = null;
    setConnectHint(win, st);
    paintNodeStates(win);
    return;
  }

  const firstId = st.connectFirst;
  st.connectFirst = null;
  paintNodeStates(win);
  setConnectHint(win, st);

  const ok = await performConnect(win, firstId, sn.id, graph);
  if (ok) afterConnectSuccess(win);
}

/**
 * Shared connect flow used by connect-mode clicks, shift-drag, and bulk
 * "connect selected". Handles the already-related check, confirmation,
 * relatedItem write, and the cross-discipline bridge-tag offer.
 */
async function performConnect(
  win: Window,
  aId: number,
  bId: number,
  graph: ConnectionGraph,
  opts: { skipConfirm?: boolean; skipBridgeTag?: boolean } = {},
): Promise<boolean> {
  const a = Zotero.Items.get(aId);
  const b = Zotero.Items.get(bId);
  if (!a || !b) return false;

  if (areItemsRelated(a, b)) {
    updateHint(getString("connection-map-already-related"));
    return false;
  }

  if (!opts.skipConfirm) {
    const msg = getString("connection-map-confirm-connect", {
      args: { a: a.getDisplayTitle(), b: b.getDisplayTitle() },
    });
    if (!win.confirm(msg)) return false;
  }

  const wrote = await confirmManualConnection(a, b);
  if (!wrote) {
    updateHint(getString("connection-map-already-related"));
    return false;
  }

  if (!opts.skipBridgeTag) {
    const nodeA = graph.nodes.get(a.id);
    const nodeB = graph.nodes.get(b.id);
    if (nodeA && nodeB && isCrossDiscipline(nodeA, nodeB)) {
      const shared = suggestBridgeTagLabel(nodeA, nodeB);
      if (shared) {
        const candidate = findBridgeTagCandidate(a, b, shared);
        if (candidate) {
          const offer = getString("connection-map-offer-bridge-tag", {
            args: { tag: candidate },
          });
          if (win.confirm(offer)) {
            await offerBridgeTag(a, b, candidate, graph.nodes);
          }
        }
      }
    }
  }

  return true;
}

/** Post-write UI refresh shared by all connect flows. */
function afterConnectSuccess(win: Window) {
  updateHint(getString("connection-map-connect-done"));
  const manualToggle = win.document.getElementById(
    `${config.addonRef}-layer-manual`,
  ) as HTMLInputElement | null;
  if (manualToggle) manualToggle.checked = true;
  const refreshBtn = win.document.getElementById(
    `${config.addonRef}-connection-map-refresh`,
  ) as HTMLButtonElement | null;
  refreshBtn?.click();
}

async function finishShiftConnect(
  win: Window,
  fromId: number,
  toId: number,
  graph: ConnectionGraph,
) {
  const ok = await performConnect(win, fromId, toId, graph);
  if (ok) afterConnectSuccess(win);
}

/** Bulk-connect every pair in the current multi-selection. */
async function connectSelected(
  win: Window,
  st: RendererState,
  graph: ConnectionGraph,
) {
  const ids = [...st.selected];
  if (ids.length < 2) return;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
  }
  const msg = getString("connection-map-connect-selected-confirm", {
    args: { count: pairs.length },
  });
  if (!win.confirm(msg)) return;

  let made = 0;
  for (const [a, b] of pairs) {
    const ok = await performConnect(win, a, b, graph, {
      skipConfirm: true,
      skipBridgeTag: true,
    });
    if (ok) made++;
  }

  st.selected.clear();
  updateSelectionUI(win, st);
  paintNodeStates(win);
  if (made > 0) afterConnectSuccess(win);
}

/** Toggle a node's fixed-position pin state. */
function togglePin(win: Window, st: RendererState, id: number) {
  if (st.pinned.has(id)) st.pinned.delete(id);
  else st.pinned.add(id);
  paintNodeStates(win);
}

function toggleSelect(win: Window, st: RendererState, id: number) {
  if (st.selected.has(id)) st.selected.delete(id);
  else st.selected.add(id);
  paintNodeStates(win);
  updateSelectionUI(win, st);
}

function updateSelectionUI(win: Window, st: RendererState) {
  const btn = win.document.getElementById(
    `${config.addonRef}-connection-map-connect-selected`,
  ) as HTMLButtonElement | null;
  if (btn) {
    if (st.selected.size >= 2) {
      btn.style.display = "";
      btn.textContent = getString("connection-map-connect-selected", {
        args: { count: st.selected.size },
      });
    } else {
      btn.style.display = "none";
    }
  }
  if (st.selected.size > 0) {
    const hint = win.document.getElementById(
      `${config.addonRef}-connection-map-hint`,
    );
    if (hint) {
      hint.textContent = getString("connection-map-select-hint", {
        args: { count: st.selected.size },
      });
    }
  } else {
    setConnectHint(win, st);
  }
}

/** Simple fixed-position context menu with a handful of node actions. */
function showNodeContextMenu(
  win: Window,
  st: RendererState,
  sn: SimNode,
  clientX: number,
  clientY: number,
) {
  closeContextMenu(win);
  const doc = win.document;
  const menu = doc.createElement("div");
  menu.style.cssText = [
    "position:fixed",
    `left:${clientX}px`,
    `top:${clientY}px`,
    "z-index:1000",
    "background:var(--map-card)",
    "border:1px solid var(--map-border)",
    "border-radius:6px",
    "box-shadow:0 4px 16px rgba(0,0,0,.28)",
    "padding:4px",
    "font:13px system-ui, Segoe UI, sans-serif",
    "min-width:190px",
    "color:var(--map-fg)",
  ].join(";");

  const items: Array<{ label: string; action: () => void }> = [
    {
      label: getString("connection-map-ctx-show"),
      action: () => {
        try {
          Zotero.getActiveZoteroPane()?.selectItem(sn.id);
        } catch (e) {
          ztoolkit.log("selectItem failed", e);
        }
      },
    },
    {
      label: getString("connection-map-ctx-connect-from"),
      action: () => {
        st.connectMode = true;
        st.connectFirst = sn.id;
        const connectBtn = doc.getElementById(
          `${config.addonRef}-connection-map-connect`,
        );
        connectBtn?.classList.add("active");
        setConnectHint(win, st);
        paintNodeStates(win);
      },
    },
    {
      label: st.pinned.has(sn.id)
        ? getString("connection-map-ctx-unpin")
        : getString("connection-map-ctx-pin"),
      action: () => togglePin(win, st, sn.id),
    },
  ];

  for (const it of items) {
    const row = doc.createElement("div");
    row.textContent = it.label;
    row.style.cssText = "padding:6px 10px;border-radius:4px;cursor:pointer;";
    row.addEventListener(
      "pointerenter",
      () => (row.style.background = "var(--map-panel)"),
    );
    row.addEventListener("pointerleave", () => (row.style.background = ""));
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      it.action();
      closeContextMenu(win);
    });
    menu.appendChild(row);
  }

  doc.body.appendChild(menu);
  st.contextMenuEl = menu;

  const closeOnce = () => {
    closeContextMenu(win);
    win.removeEventListener("pointerdown", closeOnce, true);
  };
  win.addEventListener("pointerdown", closeOnce, true);
}

function closeContextMenu(win: Window) {
  const st = stateByWin.get(win);
  if (st?.contextMenuEl) {
    st.contextMenuEl.remove();
    st.contextMenuEl = null;
  }
}

function ensureShiftLine(win: Window, root: SVGElement): SVGLineElement {
  const st = stateByWin.get(win)!;
  if (st.shiftConnectLine) return st.shiftConnectLine;
  const doc = win.document;
  const line = doc.createElementNS(
    "http://www.w3.org/2000/svg",
    "line",
  ) as SVGLineElement;
  line.setAttribute("stroke", "var(--map-bridge)");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-dasharray", "6 4");
  line.setAttribute("pointer-events", "none");
  root.appendChild(line);
  st.shiftConnectLine = line;
  return line;
}

function updateShiftLine(
  win: Window,
  from: { x: number; y: number },
  tx: number,
  ty: number,
) {
  const st = stateByWin.get(win);
  if (!st?.shiftConnectLine) return;
  st.shiftConnectLine.setAttribute("x1", String(from.x));
  st.shiftConnectLine.setAttribute("y1", String(from.y));
  st.shiftConnectLine.setAttribute("x2", String(tx));
  st.shiftConnectLine.setAttribute("y2", String(ty));
}

function removeShiftLine(win: Window) {
  const st = stateByWin.get(win);
  if (st?.shiftConnectLine) {
    st.shiftConnectLine.remove();
    st.shiftConnectLine = null;
  }
}

function suggestBridgeTagLabel(a: GraphNode, b: GraphNode): string | null {
  // Simple proposal: join primary discipline labels if cross-discipline.
  if (!a.disciplineLabels.length || !b.disciplineLabels.length) return null;
  const left = a.disciplineLabels[0];
  const right = b.disciplineLabels[0];
  if (!left || !right || left === right) return null;
  if (left === "Unsorted" || right === "Unsorted") return null;
  return `${left} × ${right}`;
}

function edgeTooltip(
  edge: GraphEdge,
  sourceNode: GraphNode,
  targetNode: GraphNode,
): string {
  const parts = [`${edge.layer} · ${edge.state}`];
  if (edge.viaTags?.length) {
    parts.push(
      getString("connection-map-node-tooltip-tags", {
        args: { tags: edge.viaTags.join(", ") },
      }),
    );
  }
  if (edge.crossDiscipline) {
    parts.push(
      `${getString("connection-map-cross-discipline-hint")} (${getNodeDisciplineKey(sourceNode)} ↔ ${getNodeDisciplineKey(targetNode)})`,
    );
  }
  if (edge.state === "suggested") {
    parts.push(`${Math.round(edge.confidence * 100)}%`);
  }
  if (edge.layer === "manual") {
    parts.push(getString("connection-map-remove-hint"));
  }
  return parts.join("\n");
}

function wireViewportControls(
  win: Window,
  svg: SVGSVGElement,
  root: SVGElement,
  st: RendererState,
  graph: ConnectionGraph,
) {
  const endPointer = (pe?: PointerEvent) => {
    if (
      pe &&
      st.activePointerId != null &&
      pe.pointerId !== st.activePointerId
    ) {
      return;
    }
    if (st.activePointerId != null) {
      try {
        if (svg.hasPointerCapture?.(st.activePointerId)) {
          svg.releasePointerCapture(st.activePointerId);
        }
      } catch {
        /* ignore */
      }
    }
    if (st.shiftConnectFrom) {
      const fromId = st.shiftConnectFrom.id;
      const toId = st.hoverTargetId;
      st.shiftConnectFrom = null;
      st.hoverTargetId = null;
      removeShiftLine(win);
      paintNodeStates(win);
      if (toId != null && toId !== fromId) {
        void finishShiftConnect(win, fromId, toId, graph);
      }
    }
    st.dragging = null;
    st.dragStart = null;
    st.panning = false;
    st.panLast = null;
    st.activePointerId = null;
    svg.classList.remove("is-panning", "is-dragging-node");
  };

  svg.addEventListener(
    "wheel",
    (ev) => {
      const we = ev as WheelEvent;
      we.preventDefault();
      const delta =
        we.deltaMode === 1
          ? we.deltaY * 16
          : we.deltaMode === 2
            ? we.deltaY * (st.viewSize.h || 600)
            : we.deltaY;
      const factor = Math.exp(-delta * 0.0018);
      zoomAt(svg, root, st, we.clientX, we.clientY, factor);
    },
    { passive: false },
  );

  svg.addEventListener("pointerdown", (ev) => {
    const pe = ev as PointerEvent;
    if (st.dragging) return;

    const middle = pe.button === 1;
    const left = pe.button === 0;
    if (!middle && !left) return;
    if (left && !st.spaceHeld && pe.target !== svg && pe.target !== root) {
      // Node/edge handlers manage their own interactions.
      const t = pe.target as Element | null;
      if (t?.closest?.("g[data-node-id], path[data-edge-id]")) return;
    }

    pe.preventDefault();
    try {
      svg.setPointerCapture(pe.pointerId);
    } catch {
      /* ignore */
    }
    st.activePointerId = pe.pointerId;
    st.panning = true;
    st.panLast = { x: pe.clientX, y: pe.clientY };
    svg.classList.add("is-panning");
  });

  svg.addEventListener("pointermove", (ev) => {
    const pe = ev as PointerEvent;
    if (st.activePointerId != null && pe.pointerId !== st.activePointerId) {
      return;
    }

    if (st.shiftConnectFrom) {
      const pt = clientToSvg(svg, pe.clientX, pe.clientY, st.transform);
      updateShiftLine(win, st.shiftConnectFrom, pt.x, pt.y);
      const el = win.document.elementFromPoint(pe.clientX, pe.clientY);
      const nodeG = (el as Element | null)?.closest?.("g[data-node-id]");
      const rawHoverId = nodeG
        ? Number(nodeG.getAttribute("data-node-id"))
        : null;
      const hoverId = rawHoverId === st.shiftConnectFrom.id ? null : rawHoverId;
      if (hoverId !== st.hoverTargetId) {
        st.hoverTargetId = hoverId;
        paintNodeStates(win);
      }
      return;
    }

    if (st.dragging) {
      if (st.dragStart) {
        const dx = pe.clientX - st.dragStart.x;
        const dy = pe.clientY - st.dragStart.y;
        if (dx * dx + dy * dy > 9) st.dragMoved = true;
      }
      if (st.dragMoved) {
        const pt = clientToSvg(svg, pe.clientX, pe.clientY, st.transform);
        st.dragging.x = pt.x;
        st.dragging.y = pt.y;
        st.dragging.vx = 0;
        st.dragging.vy = 0;
        st.energy = 1;
        paint(win);
      }
      return;
    }

    if (st.panning && st.panLast) {
      st.transform.x += pe.clientX - st.panLast.x;
      st.transform.y += pe.clientY - st.panLast.y;
      st.panLast = { x: pe.clientX, y: pe.clientY };
      applyTransform(root, st.transform);
    }
  });

  svg.addEventListener("pointerup", (ev) => endPointer(ev as PointerEvent));
  svg.addEventListener("pointercancel", (ev) => endPointer(ev as PointerEvent));
  svg.addEventListener("lostpointercapture", () => endPointer());

  svg.addEventListener("dblclick", (ev) => {
    const t = ev.target as Element | null;
    if (t?.closest?.("g[data-node-id], path[data-edge-id]")) return;
    ev.preventDefault();
    fitView(st);
    applyViewport(root, svg, st.transform);
  });

  // Middle-click autoscroll / paste prevention.
  svg.addEventListener("auxclick", (ev) => {
    if ((ev as MouseEvent).button === 1) ev.preventDefault();
  });
  svg.addEventListener("contextmenu", (ev) => {
    const t = ev.target as Element | null;
    if (!t?.closest?.("path[data-edge-id]")) ev.preventDefault();
  });

  const onKeyDown = (ev: KeyboardEvent) => {
    const cur = stateByWin.get(win);
    if (!cur) return;
    const tag = (ev.target as Element | null)?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (ev.code === "Space" && !ev.repeat) {
      ev.preventDefault();
      cur.spaceHeld = true;
      svg.classList.add("is-space-pan");
    } else if (ev.key === "0" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      fitView(cur);
      applyViewport(root, svg, cur.transform);
    } else if (ev.key === "+" || ev.key === "=") {
      const rect = svg.getBoundingClientRect();
      zoomAt(
        svg,
        root,
        cur,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        1.12,
      );
    } else if (ev.key === "-" || ev.key === "_") {
      const rect = svg.getBoundingClientRect();
      zoomAt(
        svg,
        root,
        cur,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        1 / 1.12,
      );
    } else if (ev.key === "Escape") {
      let changed = false;
      if (cur.shiftConnectFrom) {
        cur.shiftConnectFrom = null;
        cur.hoverTargetId = null;
        removeShiftLine(win);
        changed = true;
      }
      if (cur.connectFirst != null) {
        cur.connectFirst = null;
        changed = true;
      }
      if (cur.selected.size) {
        cur.selected.clear();
        updateSelectionUI(win, cur);
        changed = true;
      }
      closeContextMenu(win);
      if (changed) {
        setConnectHint(win, cur);
        paintNodeStates(win);
      }
    }
  };
  const onKeyUp = (ev: KeyboardEvent) => {
    const cur = stateByWin.get(win);
    if (!cur) return;
    if (ev.code === "Space") {
      cur.spaceHeld = false;
      svg.classList.remove("is-space-pan");
    }
  };
  const onBlur = () => {
    const cur = stateByWin.get(win);
    if (!cur) return;
    cur.spaceHeld = false;
    svg.classList.remove("is-space-pan");
  };

  // Zotero chrome windows may lack AbortController — manual teardown instead.
  type ControlsHost = Window & {
    __cmControlsCleanup?: () => void;
  };
  const host = win as ControlsHost;
  host.__cmControlsCleanup?.();
  win.addEventListener("keydown", onKeyDown);
  win.addEventListener("keyup", onKeyUp);
  win.addEventListener("blur", onBlur);
  host.__cmControlsCleanup = () => {
    win.removeEventListener("keydown", onKeyDown);
    win.removeEventListener("keyup", onKeyUp);
    win.removeEventListener("blur", onBlur);
  };
}

function zoomAt(
  svg: SVGSVGElement,
  root: SVGElement,
  st: RendererState,
  clientX: number,
  clientY: number,
  factor: number,
) {
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const viewW = svg.viewBox.baseVal.width || st.viewSize.w || rect.width;
  const viewH = svg.viewBox.baseVal.height || st.viewSize.h || rect.height;
  const mx = ((clientX - rect.left) / rect.width) * viewW;
  const my = ((clientY - rect.top) / rect.height) * viewH;
  const wx = (mx - st.transform.x) / st.transform.k;
  const wy = (my - st.transform.y) / st.transform.k;
  const nextK = Math.min(6, Math.max(0.12, st.transform.k * factor));
  st.transform.k = nextK;
  st.transform.x = mx - wx * nextK;
  st.transform.y = my - wy * nextK;
  applyViewport(root, svg, st.transform);
}

function fitView(st: RendererState) {
  const nodes = st.simNodes;
  const { w, h } = st.viewSize;
  if (!nodes.length || !w || !h) {
    st.transform = { x: 0, y: 0, k: 1 };
    return;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  const bw = Math.max(40, maxX - minX);
  const bh = Math.max(40, maxY - minY);
  const pad = 56;
  const k = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 2.2);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  st.transform.k = Math.max(0.15, k);
  st.transform.x = w / 2 - cx * st.transform.k;
  st.transform.y = h / 2 - cy * st.transform.k;
}

function syncScreenFixedLabels(svg: Element, k: number) {
  const inv = 1 / Math.max(k, 0.001);
  const wraps = svg.querySelectorAll(".node-label-wrap");
  for (let i = 0; i < wraps.length; i++) {
    const wrap = wraps.item(i) as Element | null;
    if (!wrap) continue;
    const r = Number(wrap.getAttribute("data-anchor-r") || "8");
    wrap.setAttribute("transform", `translate(0,${r}) scale(${inv})`);
  }
}

function syncOneLabel(el: Element, k: number) {
  const hub = el.getAttribute("data-hub") === "1";
  const showAll = k >= 1.45;
  (el as SVGElement).style.display = hub || showAll ? "" : "none";
}

function syncLabelVisibility(svg: Element, k: number) {
  const labels = svg.querySelectorAll(".node-label");
  for (let i = 0; i < labels.length; i++) {
    const el = labels.item(i) as Element | null;
    if (!el) continue;
    syncOneLabel(el, k);
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function applyTransform(g: SVGElement, t: { x: number; y: number; k: number }) {
  g.setAttribute("transform", `translate(${t.x},${t.y}) scale(${t.k})`);
}

function applyViewport(
  root: SVGElement,
  svg: Element,
  t: { x: number; y: number; k: number },
) {
  applyTransform(root, t);
  syncScreenFixedLabels(svg, t.k);
  syncLabelVisibility(svg, t.k);
}

function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  t: { x: number; y: number; k: number },
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const viewW = svg.viewBox.baseVal.width || rect.width;
  const viewH = svg.viewBox.baseVal.height || rect.height;
  const sx = ((clientX - rect.left) / rect.width) * viewW;
  const sy = ((clientY - rect.top) / rect.height) * viewH;
  return {
    x: (sx - t.x) / t.k,
    y: (sy - t.y) / t.k,
  };
}

function startLoop(win: Window) {
  const st = stateByWin.get(win);
  if (!st) return;
  if (st.raf != null) win.cancelAnimationFrame(st.raf);

  const tick = () => {
    const cur = stateByWin.get(win);
    if (!cur) return;
    // Lower threshold so soft springs keep drifting until nearly still.
    if (cur.energy > 0.002) {
      stepForces(cur);
      paint(win);
    }
    cur.raf = win.requestAnimationFrame(tick);
  };
  st.raf = win.requestAnimationFrame(tick);
}

/** Full all-pairs repulsion is O(n²); above this, use sparse samples. */
const FULL_REPULSE_NODE_CAP = 180;
const SPARSE_REPULSE_SAMPLES = 14;

function applyPairRepulse(
  a: SimNode,
  b: SimNode,
  repulsion: number,
  maxRepulse: number,
) {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let dist2 = dx * dx + dy * dy;
  if (dist2 < 0.01) {
    dx = Math.random() - 0.5;
    dy = Math.random() - 0.5;
    dist2 = dx * dx + dy * dy;
  }
  const dist = Math.sqrt(dist2);
  let force = repulsion / dist2;
  if (force > maxRepulse) force = maxRepulse;
  const fx = (dx / dist) * force;
  const fy = (dy / dist) * force;
  a.vx += fx;
  a.vy += fy;
  b.vx -= fx;
  b.vy -= fy;
}

function stepForces(st: RendererState) {
  const nodes = st.simNodes;
  const n = nodes.length;
  if (!n) {
    st.energy = 0;
    return;
  }

  // Zero-g threads: bendable ropes (midpoints lag) + soft repulsion.
  const repulsion = 380;
  const thread = 0.008;
  const midPull = 0.028;
  const midDamp = 0.9;
  const centering = 0.001;
  const damp = 0.94;
  const maxRepulse = 1.8;
  const maxTension = 1.4;

  let cx = 0;
  let cy = 0;
  for (const a of nodes) {
    cx += a.x;
    cy += a.y;
  }
  cx /= n;
  cy /= n;

  if (n <= FULL_REPULSE_NODE_CAP) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        applyPairRepulse(nodes[i], nodes[j], repulsion, maxRepulse);
      }
    }
  } else {
    // Sparse: edge endpoints + fixed samples per node (keeps UI responsive).
    for (const se of st.simEdges) {
      applyPairRepulse(se.source, se.target, repulsion * 1.2, maxRepulse);
    }
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let s = 0; s < SPARSE_REPULSE_SAMPLES; s++) {
        const j = (i * 17 + s * 31 + 7) % n;
        if (j === i) continue;
        if (j < i) continue; // apply once per unordered pair in sample set
        applyPairRepulse(a, nodes[j], repulsion, maxRepulse);
      }
    }
  }

  for (const se of st.simEdges) {
    const a = se.source;
    const b = se.target;
    const [m0, m1] = se.mids;
    const chord = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) || 1;
    const segRest = Math.max(chord / 3, 24);

    // Soft anchors toward 1/3 and 2/3 of the chord — weak so mids lag and the thread bends.
    const r0x = a.x + (b.x - a.x) / 3;
    const r0y = a.y + (b.y - a.y) / 3;
    const r1x = a.x + (2 * (b.x - a.x)) / 3;
    const r1y = a.y + (2 * (b.y - a.y)) / 3;
    m0.vx += (r0x - m0.x) * midPull;
    m0.vy += (r0y - m0.y) * midPull;
    m1.vx += (r1x - m1.x) * midPull;
    m1.vy += (r1y - m1.y) * midPull;

    // Chain tension only when a segment is taut (string, not rod).
    softThreadLink(a, m0, segRest, thread, maxTension, true);
    softThreadLink(m0, m1, segRest, thread, maxTension, false);
    softThreadLink(m1, b, segRest, thread, maxTension, true);

    m0.vx *= midDamp;
    m0.vy *= midDamp;
    m1.vx *= midDamp;
    m1.vy *= midDamp;
    m0.x += m0.vx;
    m0.y += m0.vy;
    m1.x += m1.vx;
    m1.y += m1.vy;
  }

  let energy = 0;
  for (const a of nodes) {
    if (st.dragging === a) continue;
    if (st.pinned.has(a.id)) {
      a.vx = 0;
      a.vy = 0;
      continue;
    }
    a.vx += (cx - a.x) * centering;
    a.vy += (cy - a.y) * centering;
    a.vx *= damp;
    a.vy *= damp;
    a.x += a.vx;
    a.y += a.vy;
    energy += a.vx * a.vx + a.vy * a.vy;
  }
  for (const se of st.simEdges) {
    for (const m of se.mids) {
      energy += m.vx * m.vx + m.vy * m.vy;
    }
  }
  st.energy = energy / Math.max(1, n + st.simEdges.length);
}

/** Pull only when stretched past rest (slack string). Optionally tug SimNode ends. */
function softThreadLink(
  p: { x: number; y: number; vx: number; vy: number },
  q: { x: number; y: number; vx: number; vy: number },
  rest: number,
  k: number,
  maxF: number,
  tugNodes: boolean,
) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const stretch = dist - rest;
  if (stretch <= 0) return;
  let f = stretch * k;
  if (f > maxF) f = maxF;
  const fx = (dx / dist) * f;
  const fy = (dy / dist) * f;
  if (tugNodes) {
    p.vx += fx;
    p.vy += fy;
    q.vx -= fx;
    q.vy -= fy;
  } else {
    p.vx += fx * 0.5;
    p.vy += fy * 0.5;
    q.vx -= fx * 0.5;
    q.vy -= fy * 0.5;
  }
}

function initRopeMids(s: SimNode, t: SimNode): [RopePoint, RopePoint] {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  let nx = -dy;
  let ny = dx;
  const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
  nx = (nx / nlen) * 10;
  ny = (ny / nlen) * 10;
  return [
    {
      x: s.x + dx / 3 + nx,
      y: s.y + dy / 3 + ny,
      vx: 0,
      vy: 0,
    },
    {
      x: s.x + (2 * dx) / 3 - nx,
      y: s.y + (2 * dy) / 3 - ny,
      vx: 0,
      vy: 0,
    },
  ];
}

function ropePathD(se: SimEdge): string {
  const a = se.source;
  const b = se.target;
  const [m0, m1] = se.mids;
  return `M ${a.x} ${a.y} C ${m0.x} ${m0.y} ${m1.x} ${m1.y} ${b.x} ${b.y}`;
}

function paint(win: Window) {
  const st = stateByWin.get(win);
  if (!st) return;

  for (const se of st.simEdges) {
    const path = se.el;
    if (!path) continue;
    path.setAttribute("d", ropePathD(se));
  }

  for (const sn of st.simNodes) {
    const g = sn.el;
    if (!g) continue;
    g.setAttribute("transform", `translate(${sn.x},${sn.y})`);
  }
}
