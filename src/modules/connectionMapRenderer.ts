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

export type ConnectionMapLayerState = {
  tag: boolean;
  manual: boolean;
  semantic: boolean;
  note: boolean;
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
};

type SimEdge = {
  edge: GraphEdge;
  source: SimNode;
  target: SimNode;
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
};

const stateByWin = new WeakMap<Window, RendererState>();

export { renderConnectionMap, updateConnectionMapGraph, edgeStyle };

function edgeStyle(edge: GraphEdge): {
  stroke: string;
  width: number;
  dash: string;
  opacity: number;
} {
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
      paintConnectSelection(win);
    };
  }

  for (const layer of ["tag", "manual", "semantic", "note"] as const) {
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

function paintConnectSelection(win: Window) {
  const st = stateByWin.get(win);
  const canvas = win.document.getElementById(
    `${config.addonRef}-connection-map-canvas`,
  );
  if (!st || !canvas) return;
  canvas.querySelectorAll("g[data-node-id] circle").forEach((el) => {
    const circle = el as SVGCircleElement;
    const g = circle.parentElement;
    const id = Number(g?.getAttribute("data-node-id"));
    if (st.connectMode && st.connectFirst === id) {
      circle.setAttribute("stroke", "var(--map-bridge)");
      circle.setAttribute("stroke-width", "2.5");
    } else {
      circle.setAttribute("stroke", "var(--map-node-stroke)");
      circle.setAttribute("stroke-width", "1.25");
    }
  });
}

function updateZotSeekUI(win: Window, ready: boolean) {
  const doc = win.document;
  const semanticWrap = doc.getElementById(
    `${config.addonRef}-layer-semantic-wrap`,
  );
  const missing = doc.getElementById(
    `${config.addonRef}-zotseek-missing`,
  );
  if (semanticWrap) {
    (semanticWrap as HTMLElement).style.display = ready ? "" : "none";
  }
  if (missing) {
    missing.textContent = getString("connection-map-zotseek-missing");
    (missing as HTMLElement).style.display = ready ? "none" : "";
  }
  if (!ready) {
    const el = doc.getElementById(
      `${config.addonRef}-layer-semantic`,
    ) as HTMLInputElement | null;
    if (el) el.checked = false;
  }
}

function visibleEdges(
  graph: ConnectionGraph,
  layerState: ConnectionMapLayerState,
): GraphEdge[] {
  return graph.edges.filter((e) => {
    if (e.layer === "tag" && !layerState.tag) return false;
    if (e.layer === "manual" && !layerState.manual) return false;
    if (e.layer === "semantic" && !layerState.semantic) return false;
    if (e.layer === "note" && !layerState.note) return false;
    return true;
  });
}

function buildSimulation(
  win: Window,
  graph: ConnectionGraph,
  layerState: ConnectionMapLayerState,
  oldPos?: Map<number, { x: number; y: number }>,
) {
  const doc = win.document;
  const canvas = doc.getElementById(
    `${config.addonRef}-connection-map-canvas`,
  );
  if (!canvas) return;

  const filterEl = doc.getElementById(
    `${config.addonRef}-connection-map-filter`,
  ) as HTMLInputElement | null;
  const filter = (filterEl?.value || "").trim().toLocaleLowerCase("tr");

  const edges = visibleEdges(graph, layerState);
  const nodeIDs = new Set<number>();
  for (const e of edges) {
    nodeIDs.add(e.source);
    nodeIDs.add(e.target);
  }

  const MAX_ISOLATE_NODES = 200;
  // Always show isolates when the graph would otherwise be empty/sparse —
  // otherwise a library with few co-occurrence edges looks "broken".
  const needIsolates = nodeIDs.size < 8 || edges.length === 0;
  if (filter) {
    for (const [id, node] of graph.nodes) {
      const hay =
        `${node.title} ${node.creatorSummary} ${node.disciplineLabels.join(" ")}`.toLocaleLowerCase(
          "tr",
        );
      if (hay.includes(filter)) nodeIDs.add(id);
    }
  } else if (needIsolates) {
    let added = 0;
    for (const id of graph.nodes.keys()) {
      if (nodeIDs.has(id)) continue;
      nodeIDs.add(id);
      added++;
      if (nodeIDs.size >= MAX_ISOLATE_NODES) break;
      if (added >= MAX_ISOLATE_NODES) break;
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
      const hayS = `${s.node.title} ${s.node.creatorSummary}`.toLocaleLowerCase("tr");
      const hayT = `${t.node.title} ${t.node.creatorSummary}`.toLocaleLowerCase("tr");
      if (!hayS.includes(filter) && !hayT.includes(filter)) continue;
    }
    simEdges.push({ edge, source: s, target: t });
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
    const line = doc.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("data-edge-id", se.edge.id);
    const style = edgeStyle(se.edge);
    line.setAttribute("stroke", style.stroke);
    line.setAttribute("stroke-width", String(style.width));
    line.setAttribute("stroke-opacity", String(style.opacity));
    if (style.dash) line.setAttribute("stroke-dasharray", style.dash);
    line.style.cursor =
      se.edge.state === "suggested" || se.edge.layer === "manual"
        ? "pointer"
        : "default";

    const title = doc.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = edgeTooltip(se.edge, se.source.node, se.target.node);
    line.appendChild(title);

    if (se.edge.state === "suggested") {
      line.addEventListener("click", async (ev) => {
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
      line.addEventListener("contextmenu", async (ev) => {
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
    edgeLayer.appendChild(line);
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
    const r = Math.min(14, 5 + Math.sqrt(degree + sn.node.tagCount) * 1.2);

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
      sn.node.disciplineLabels.join(", "),
      getNodeDisciplineKey(sn.node),
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
    });
    g.addEventListener("pointerleave", () => {
      syncOneLabel(label, st.transform.k);
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

    nodeLayer.appendChild(g);
  }

  root.appendChild(edgeLayer);
  root.appendChild(nodeLayer);
  svg.appendChild(root);
  canvas.appendChild(svg);
  paintConnectSelection(win);
  applyViewport(root, svg, st.transform);
  wireViewportControls(win, svg, root, st);
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
    paintConnectSelection(win);
    return;
  }
  if (st.connectFirst === sn.id) {
    st.connectFirst = null;
    setConnectHint(win, st);
    paintConnectSelection(win);
    return;
  }

  const firstId = st.connectFirst;
  const a = Zotero.Items.get(firstId);
  const b = Zotero.Items.get(sn.id);
  st.connectFirst = null;
  paintConnectSelection(win);
  setConnectHint(win, st);
  if (!a || !b) return;

  if (areItemsRelated(a, b)) {
    updateHint(getString("connection-map-already-related"));
    return;
  }

  const msg = getString("connection-map-confirm-connect", {
    args: { a: a.getDisplayTitle(), b: b.getDisplayTitle() },
  });
  if (!win.confirm(msg)) return;

  const wrote = await confirmManualConnection(a, b);
  if (!wrote) {
    updateHint(getString("connection-map-already-related"));
    return;
  }

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

  updateHint(getString("connection-map-connect-done"));

  // Ensure manual layer is visible after creating a relation.
  const manualToggle = win.document.getElementById(
    `${config.addonRef}-layer-manual`,
  ) as HTMLInputElement | null;
  if (manualToggle) manualToggle.checked = true;

  const refreshBtn = win.document.getElementById(
    `${config.addonRef}-connection-map-refresh`,
  ) as HTMLButtonElement | null;
  refreshBtn?.click();
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
      if (t?.closest?.("g[data-node-id], line[data-edge-id]")) return;
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
    if (
      st.activePointerId != null &&
      pe.pointerId !== st.activePointerId
    ) {
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
    if (t?.closest?.("g[data-node-id], line[data-edge-id]")) return;
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
    if (!t?.closest?.("line[data-edge-id]")) ev.preventDefault();
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

function applyTransform(
  g: SVGElement,
  t: { x: number; y: number; k: number },
) {
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
    if (cur.energy > 0.01) {
      stepForces(cur);
      paint(win);
    }
    cur.raf = win.requestAnimationFrame(tick);
  };
  st.raf = win.requestAnimationFrame(tick);
}

function stepForces(st: RendererState) {
  const nodes = st.simNodes;
  const n = nodes.length;
  if (!n) {
    st.energy = 0;
    return;
  }

  const repulsion = 1200;
  const spring = 0.04;
  const springLen = 90;
  const centering = 0.01;
  const damp = 0.85;

  let cx = 0;
  let cy = 0;
  for (const a of nodes) {
    cx += a.x;
    cy += a.y;
  }
  cx /= n;
  cy /= n;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist2 = dx * dx + dy * dy;
      if (dist2 < 0.01) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        dist2 = dx * dx + dy * dy;
      }
      const dist = Math.sqrt(dist2);
      const force = repulsion / dist2;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  for (const se of st.simEdges) {
    const a = se.source;
    const b = se.target;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (dist - springLen) * spring;
    const fx = (dx / dist) * f;
    const fy = (dy / dist) * f;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  let energy = 0;
  for (const a of nodes) {
    if (st.dragging === a) continue;
    a.vx += (cx - a.x) * centering;
    a.vy += (cy - a.y) * centering;
    a.vx *= damp;
    a.vy *= damp;
    a.x += a.vx;
    a.y += a.vy;
    energy += a.vx * a.vx + a.vy * a.vy;
  }
  st.energy = energy / n;
}

function paint(win: Window) {
  const st = stateByWin.get(win);
  if (!st) return;
  const doc = win.document;
  const canvas = doc.getElementById(
    `${config.addonRef}-connection-map-canvas`,
  );
  if (!canvas) return;

  for (const se of st.simEdges) {
    const line = canvas.querySelector(
      `line[data-edge-id="${cssEscape(se.edge.id)}"]`,
    ) as SVGLineElement | null;
    if (!line) continue;
    line.setAttribute("x1", String(se.source.x));
    line.setAttribute("y1", String(se.source.y));
    line.setAttribute("x2", String(se.target.x));
    line.setAttribute("y2", String(se.target.y));
  }

  for (const sn of st.simNodes) {
    const g = canvas.querySelector(
      `g[data-node-id="${sn.id}"]`,
    ) as SVGGElement | null;
    if (!g) continue;
    g.setAttribute("transform", `translate(${sn.x},${sn.y})`);
  }
}

function cssEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
