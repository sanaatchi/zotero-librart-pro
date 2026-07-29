import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { isWindowAlive } from "../utils/window";
import { updateHint } from "../utils/hint";
import { TagAnalysisReport, analyzeLibraryTags } from "../utils/tagAnalysis";
import { mergeTags, deleteTags } from "../utils/tagActions";
import {
  findItemsMissingMetadata,
  previewEnrichment,
  applyEnrichment,
  detectUnregisteredItemTypes,
  EnrichmentProposal,
} from "../utils/metadataEnrichment";
import { isLocalBookDbConfigured } from "../utils/localBookDb";

export { openTagDashboard, initTagDashboardWindow };

const DASHBOARD_ID = `${config.addonRef}-tag-dashboard`;

async function openTagDashboard() {
  if (isWindowAlive(addon.data.tagDashboard?.window)) {
    addon.data.tagDashboard!.window!.focus();
    return;
  }

  const mainWin = Zotero.getMainWindow();
  if (!mainWin) return;

  const url = `chrome://${config.addonRef}/content/tag-dashboard.xhtml`;
  const features =
    "chrome,centerscreen,resizable,dialog=no,width=1120,height=860";
  const win =
    (mainWin.openDialog(url, DASHBOARD_ID, features) as Window | null) ||
    (mainWin.open(url, DASHBOARD_ID, features) as Window | null);
  if (!win) return;

  addon.data.tagDashboard = { window: win };
  win.addEventListener("unload", () => {
    if (addon.data.tagDashboard?.window === win) {
      addon.data.tagDashboard.window = undefined;
    }
  });

  // Chrome HTML windows do not see the Zotero global — init from plugin scope.
  await waitForWindowLoad(win);
  await initTagDashboardWindow(win);
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

async function initTagDashboardWindow(win: Window) {
  const doc = win.document;
  doc.title = getString("tag-dashboard-title");
  const root = doc.getElementById(`${config.addonRef}-dashboard-root`);
  const status = doc.getElementById(`${config.addonRef}-dashboard-status`);
  if (!root) return;

  if (status) status.textContent = getString("tag-dashboard-loading");

  try {
    const report = await analyzeLibraryTags();
    const missingItems = await findItemsMissingMetadata(report.libraryID);
    const unregisteredTypes = await detectUnregisteredItemTypes(
      report.libraryID,
    );
    const dbConfigured = isLocalBookDbConfigured();
    root.innerHTML = renderDashboard(report, {
      missingCount: missingItems.length,
      unregisteredTypes,
      dbConfigured,
    });
    if (status) {
      status.textContent = getString("tag-dashboard-updated", {
        args: {
          library: report.libraryName,
          time: new Date(report.generatedAt).toLocaleString(),
        },
      });
    }
    wireRefresh(win);
    wireActions(win, report);
    wireMetadataEnrichment(win, missingItems);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    root.innerHTML = `<div class="callout callout-warn">${escapeHtml(
      getString("tag-dashboard-error", { args: { message: msg } }),
    )}</div>`;
    if (status) status.textContent = "";
    ztoolkit.log("Tag dashboard failed", e);
  }
}

function wireRefresh(win: Window) {
  const btn = win.document.getElementById(
    `${config.addonRef}-dashboard-refresh`,
  ) as HTMLButtonElement | null;
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      await initTagDashboardWindow(win);
    } finally {
      btn.disabled = false;
    }
  };
}

function wireActions(win: Window, report: TagAnalysisReport) {
  const doc = win.document;

  doc.querySelectorAll(".btn-merge-fold").forEach((el) => {
    const btn = el as HTMLButtonElement;
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.foldIndex);
      const group = report.foldDupes[idx];
      if (!group?.length) return;
      const target = group[0].name;
      const sources = group.map((t) => t.name);
      const msg = getString("tag-dashboard-confirm-merge", {
        args: { from: sources.join(", "), to: target },
      });
      if (!win.confirm(msg)) return;
      btn.disabled = true;
      await runMerge(win, report.libraryID, sources, target);
    });
  });

  doc.querySelectorAll(".btn-merge-bilingual").forEach((el) => {
    const btn = el as HTMLButtonElement;
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.bilingualIndex);
      const pair = report.bilingualPairs[idx];
      if (!pair) return;
      const msg = getString("tag-dashboard-confirm-merge", {
        args: { from: pair.en.name, to: pair.tr.name },
      });
      if (!win.confirm(msg)) return;
      btn.disabled = true;
      await runMerge(win, report.libraryID, [pair.en.name], pair.tr.name);
    });
  });

  const mergeBtn = doc.getElementById(
    `${config.addonRef}-manual-merge-btn`,
  ) as HTMLButtonElement | null;
  mergeBtn?.addEventListener("click", async () => {
    const fromInput = doc.getElementById(
      `${config.addonRef}-manual-merge-from`,
    ) as HTMLInputElement | null;
    const toInput = doc.getElementById(
      `${config.addonRef}-manual-merge-to`,
    ) as HTMLInputElement | null;
    const sources = (fromInput?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const target = (toInput?.value || "").trim();
    if (!sources.length || !target) return;
    const msg = getString("tag-dashboard-confirm-merge", {
      args: { from: sources.join(", "), to: target },
    });
    if (!win.confirm(msg)) return;
    mergeBtn.disabled = true;
    await runMerge(win, report.libraryID, sources, target);
  });

  const deleteBtn = doc.getElementById(
    `${config.addonRef}-manual-delete-btn`,
  ) as HTMLButtonElement | null;
  deleteBtn?.addEventListener("click", async () => {
    const delInput = doc.getElementById(
      `${config.addonRef}-manual-delete`,
    ) as HTMLInputElement | null;
    const names = (delInput?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    const msg = getString("tag-dashboard-confirm-delete", {
      args: { names: names.join(", ") },
    });
    if (!win.confirm(msg)) return;
    deleteBtn.disabled = true;
    const count = await deleteTags(report.libraryID, names);
    updateHint(getString("tag-dashboard-delete-done", { args: { count } }));
    await initTagDashboardWindow(win);
  });
}

function wireMetadataEnrichment(win: Window, missingItems: Zotero.Item[]) {
  const doc = win.document;
  const previewBtn = doc.getElementById(
    `${config.addonRef}-metadata-preview`,
  ) as HTMLButtonElement | null;
  const applyAllBtn = doc.getElementById(
    `${config.addonRef}-metadata-apply-all`,
  ) as HTMLButtonElement | null;
  const results = doc.getElementById(`${config.addonRef}-metadata-results`);
  if (!previewBtn || !results) return;

  let currentProposals: EnrichmentProposal[] = [];

  const renderRow = (p: EnrichmentProposal): string => {
    const changes = Object.keys(p.proposed)
      .filter((f) => p.proposed[f])
      .map(
        (f) =>
          `${f}: ${escapeHtml(p.current[f] || "—")} → ${escapeHtml(p.proposed[f]!)}`,
      )
      .join(" · ");
    return `<div class="list-row action-row" data-metadata-item="${p.itemID}">
      <span class="action-text" title="${escapeHtml(p.title)}">
        ${escapeHtml(p.title)} <span class="pill">${escapeHtml(p.source)}</span>
        <br/><span class="muted small">${changes}</span>
      </span>
      <button type="button" class="btn-mini btn-primary btn-apply-metadata" data-item-id="${p.itemID}">${escapeHtml(
        getString("metadata-enrich-apply"),
      )}</button>
    </div>`;
  };

  const wireRow = (p: EnrichmentProposal) => {
    const row = results.querySelector(
      `[data-metadata-item="${p.itemID}"] .btn-apply-metadata`,
    ) as HTMLButtonElement | null;
    row?.addEventListener("click", async () => {
      row.disabled = true;
      const count = await applyEnrichment([p]);
      if (count) {
        updateHint(getString("metadata-enrich-done", { args: { count } }));
        row.closest(".list-row")?.remove();
        currentProposals = currentProposals.filter(
          (x) => x.itemID !== p.itemID,
        );
      } else {
        row.disabled = false;
      }
    });
  };

  previewBtn.addEventListener("click", async () => {
    previewBtn.disabled = true;
    results.innerHTML = `<div class="muted small">${escapeHtml(getString("tag-dashboard-loading"))}</div>`;
    try {
      currentProposals = await previewEnrichment(missingItems);
      if (!currentProposals.length) {
        results.innerHTML = `<div class="muted">${escapeHtml(getString("tag-dashboard-none"))}</div>`;
        if (applyAllBtn) applyAllBtn.style.display = "none";
        return;
      }
      results.innerHTML = currentProposals.map(renderRow).join("");
      currentProposals.forEach(wireRow);
      if (applyAllBtn) applyAllBtn.style.display = "";
    } finally {
      previewBtn.disabled = false;
    }
  });

  applyAllBtn?.addEventListener("click", async () => {
    if (!currentProposals.length) return;
    applyAllBtn.disabled = true;
    const count = await applyEnrichment(currentProposals);
    updateHint(getString("metadata-enrich-done", { args: { count } }));
    await initTagDashboardWindow(win);
  });
}

async function runMerge(
  win: Window,
  libraryID: number,
  sources: string[],
  target: string,
) {
  const count = await mergeTags(libraryID, sources, target);
  updateHint(
    getString("tag-dashboard-merge-done", { args: { count, target } }),
  );
  await initTagDashboardWindow(win);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return new Intl.NumberFormat(Zotero.locale || undefined).format(n);
}

type MetadataCardState = {
  missingCount: number;
  unregisteredTypes: string[];
  dbConfigured: boolean;
};

function renderMetadataCard(state: MetadataCardState): string {
  const { missingCount, unregisteredTypes, dbConfigured } = state;
  return `
<article class="card">
  <header class="card-h">
    <span>${escapeHtml(getString("metadata-enrich-title"))}</span>
    <span class="pill${missingCount ? " pill-warn" : " pill-ok"}">${fmt(missingCount)}</span>
  </header>
  <div class="card-b">
    ${
      !dbConfigured
        ? `<div class="callout callout-warn">${escapeHtml(getString("metadata-enrich-no-db"))}</div>`
        : ""
    }
    <p class="muted small">${escapeHtml(
      getString("metadata-enrich-missing-count", {
        args: { count: missingCount },
      }),
    )}</p>
    <div class="manual-row">
      <button type="button" id="${config.addonRef}-metadata-preview" class="btn-mini btn-primary" ${
        missingCount ? "" : "disabled"
      }>${escapeHtml(getString("metadata-enrich-preview"))}</button>
      <button type="button" id="${config.addonRef}-metadata-apply-all" class="btn-mini btn-primary" style="display:none">${escapeHtml(
        getString("metadata-enrich-apply-all"),
      )}</button>
    </div>
    <div id="${config.addonRef}-metadata-results" class="list"></div>
    ${
      unregisteredTypes.length
        ? `<div class="callout callout-warn small">${escapeHtml(
            getString("metadata-enrich-unregistered-types", {
              args: { types: unregisteredTypes.join(", ") },
            }),
          )}</div>`
        : ""
    }
  </div>
</article>`;
}

function renderDashboard(
  r: TagAnalysisReport,
  meta: MetadataCardState,
): string {
  const s = r.summary;
  const catEntries = [
    {
      label: getString("tag-dashboard-cat-person"),
      value: s.categories.person,
      color: "#3b82f6",
    },
    {
      label: getString("tag-dashboard-cat-concept"),
      value: s.categories.concept,
      color: "#8b5cf6",
    },
    {
      label: getString("tag-dashboard-cat-place"),
      value: s.categories.place,
      color: "#22c55e",
    },
    {
      label: getString("tag-dashboard-cat-system"),
      value: s.categories.system,
      color: "#f59e0b",
    },
  ];
  const catTotal = catEntries.reduce((a, c) => a + c.value, 0) || 1;

  const topTags = r.topTags.slice(0, 10);
  const maxTop = Math.max(...topTags.map((t) => t.count), 1);
  const dist = compressDistribution(r.tagCountDistribution);
  const maxDist = Math.max(...dist.map((d) => d.value), 1);

  return `
<header class="hero">
  <div>
    <h1>${escapeHtml(getString("tag-dashboard-title"))}</h1>
    <p class="muted small">${escapeHtml(
      getString("tag-dashboard-subtitle", {
        args: { library: r.libraryName, items: fmt(s.libraryItems) },
      }),
    )}</p>
  </div>
  <div class="hero-actions">
    <span class="pill">${escapeHtml(getString("tag-dashboard-compact"))}</span>
    <button id="${config.addonRef}-dashboard-refresh" class="btn-refresh" type="button">
      ${escapeHtml(getString("tag-dashboard-refresh"))}
    </button>
  </div>
</header>

<section class="stats">
  ${stat(fmt(s.totalTags), getString("tag-dashboard-stat-tags"))}
  ${stat(fmt(s.totalLinks), getString("tag-dashboard-stat-links"))}
  ${stat(
    `${fmt(s.taggedItems)}/${fmt(s.libraryItems)}`,
    getString("tag-dashboard-stat-tagged"),
    "ok",
  )}
  ${stat(String(s.avgTagsPerTaggedItem), getString("tag-dashboard-stat-avg"))}
  ${stat(fmt(s.singletonTags), getString("tag-dashboard-stat-singleton"), "warn")}
  ${stat(fmt(s.heavyTags), getString("tag-dashboard-stat-heavy"))}
  ${stat(fmt(s.unusedTags), getString("tag-dashboard-stat-unused"), "ok")}
  ${stat(fmt(s.untaggedItems), getString("tag-dashboard-stat-untagged"), s.untaggedItems ? "warn" : "ok")}
</section>

<div class="callout callout-info">
  ${escapeHtml(
    getString("tag-dashboard-insight", {
      args: {
        singletons: fmt(s.singletonTags),
        folds: fmt(r.foldDupes.length),
      },
    }),
  )}
</div>

${renderMetadataCard(meta)}

<div class="grid-2">
  <article class="card">
    <header class="card-h">${escapeHtml(getString("tag-dashboard-section-types"))}</header>
    <div class="card-b pie-wrap">
      ${donutSvg(catEntries, catTotal)}
      <ul class="legend">
        ${catEntries
          .map((c) => {
            const pct = ((c.value / catTotal) * 100).toFixed(
              c.value / catTotal >= 0.1 ? 0 : 1,
            );
            return `<li>
              <span class="swatch" style="background:${c.color}"></span>
              <span>${escapeHtml(c.label)}: <strong>${fmt(c.value)}</strong>
              <span class="muted">(${pct}%)</span></span>
            </li>`;
          })
          .join("")}
      </ul>
    </div>
  </article>
  <article class="card">
    <header class="card-h">${escapeHtml(getString("tag-dashboard-section-per-item"))}</header>
    <div class="card-b">
      <div class="vbars">
        ${dist
          .map((d) => {
            const h = Math.max(4, Math.round((d.value / maxDist) * 120));
            return `<div class="vbar">
              <div class="vbar-col" style="height:${h}px" title="${fmt(d.value)}"></div>
              <span class="vbar-val">${fmt(d.value)}</span>
              <span class="vbar-lab">${escapeHtml(d.label)}</span>
            </div>`;
          })
          .join("")}
      </div>
    </div>
  </article>
</div>

<article class="card">
  <header class="card-h">${escapeHtml(getString("tag-dashboard-section-top"))}</header>
  <div class="card-b">
    <div class="hbars">
      ${topTags
        .map((t) => {
          const w = Math.max(2, Math.round((t.count / maxTop) * 100));
          return `<div class="hbar">
            <span class="hbar-lab" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>
            <div class="hbar-track"><div class="hbar-fill" style="width:${w}%"></div></div>
            <span class="hbar-val">${fmt(t.count)}</span>
          </div>`;
        })
        .join("")}
    </div>
  </div>
</article>

<h2>${escapeHtml(getString("tag-dashboard-section-merge"))}</h2>
<div class="grid-3">
  <article class="card">
    <header class="card-h">
      <span>${escapeHtml(getString("tag-dashboard-fold-title"))}</span>
      <span class="pill pill-warn">${fmt(r.foldDupes.length)}</span>
    </header>
    <div class="card-b list">
      ${
        r.foldDupes.length
          ? r.foldDupes
              .slice(0, 8)
              .map((g, i) => {
                const sorted = [...g].sort((a, b) => b.count - a.count);
                const keep = sorted[0];
                const drops = sorted.slice(1);
                const line = `${keep.name}(${keep.count}) → ${drops
                  .map((t) => `${t.name}(${t.count})`)
                  .join(", ")}`;
                return `<div class="list-row action-row">
                  <span class="action-text" title="${escapeHtml(line)}">${escapeHtml(line)}</span>
                  <button type="button" class="btn-mini btn-primary btn-merge-fold" data-fold-index="${i}">${escapeHtml(
                    getString("tag-dashboard-action-merge"),
                  )}</button>
                </div>`;
              })
              .join("")
          : `<div class="muted">${escapeHtml(getString("tag-dashboard-none"))}</div>`
      }
    </div>
  </article>
  <article class="card">
    <header class="card-h">
      <span>${escapeHtml(getString("tag-dashboard-bilingual-title"))}</span>
      <span class="pill">${fmt(r.bilingualPairs.length)}</span>
    </header>
    <div class="card-b list">
      ${
        r.bilingualPairs.length
          ? r.bilingualPairs
              .map((p, i) => {
                const line = `${p.en.name}(${p.en.count}) → ${p.tr.name}(${p.tr.count})`;
                return `<div class="list-row action-row">
                  <span class="action-text" title="${escapeHtml(line)}">${escapeHtml(line)}</span>
                  <button type="button" class="btn-mini btn-primary btn-merge-bilingual" data-bilingual-index="${i}">${escapeHtml(
                    getString("tag-dashboard-action-merge"),
                  )}</button>
                </div>`;
              })
              .join("")
          : `<div class="muted">${escapeHtml(getString("tag-dashboard-none"))}</div>`
      }
    </div>
  </article>
  <article class="card">
    <header class="card-h">${escapeHtml(getString("tag-dashboard-fuzzy-title"))}</header>
    <div class="card-b list">
      ${
        r.fuzzyNear.length
          ? r.fuzzyNear
              .slice(0, 8)
              .map(
                (f) => `<div class="list-row fuzzy">
                  <span class="pill">${f.score}</span>
                  <span>${escapeHtml(`${f.a.name} ↔ ${f.b.name}`)}</span>
                </div>`,
              )
              .join("")
          : `<div class="muted">${escapeHtml(getString("tag-dashboard-none"))}</div>`
      }
      <p class="muted small fuzzy-note">${escapeHtml(getString("tag-dashboard-fuzzy-note"))}</p>
    </div>
  </article>
</div>

<article class="card">
  <header class="card-h">${escapeHtml(getString("tag-dashboard-manual-title"))}</header>
  <div class="card-b manual-grid">
    <div class="manual-block">
      <div class="manual-label">${escapeHtml(getString("tag-dashboard-action-merge"))}</div>
      <div class="manual-row">
        <input type="text" id="${config.addonRef}-manual-merge-from" placeholder="${escapeHtml(
          getString("tag-dashboard-manual-merge-from-placeholder"),
        )}" />
        <input type="text" id="${config.addonRef}-manual-merge-to" placeholder="${escapeHtml(
          getString("tag-dashboard-manual-merge-to-placeholder"),
        )}" />
        <button type="button" id="${config.addonRef}-manual-merge-btn" class="btn-mini btn-primary">${escapeHtml(
          getString("tag-dashboard-action-merge"),
        )}</button>
      </div>
    </div>
    <div class="manual-block">
      <div class="manual-label">${escapeHtml(getString("tag-dashboard-action-delete"))}</div>
      <div class="manual-row">
        <input type="text" id="${config.addonRef}-manual-delete" placeholder="${escapeHtml(
          getString("tag-dashboard-manual-delete-placeholder"),
        )}" />
        <button type="button" id="${config.addonRef}-manual-delete-btn" class="btn-mini btn-danger">${escapeHtml(
          getString("tag-dashboard-action-delete"),
        )}</button>
      </div>
    </div>
    <p class="muted small manual-hint">${escapeHtml(getString("tag-dashboard-manual-hint"))}</p>
  </div>
</article>

<table class="data-table">
  <thead><tr>
    <th>${escapeHtml(getString("tag-dashboard-col-tag"))}</th>
    <th>${escapeHtml(getString("tag-dashboard-col-count"))}</th>
  </tr></thead>
  <tbody>
    ${topTags
      .slice(0, 5)
      .map(
        (t) =>
          `<tr><td>${escapeHtml(t.name)}</td><td>${fmt(t.count)}</td></tr>`,
      )
      .join("")}
  </tbody>
</table>
`;
}

function compressDistribution(
  dist: { label: string; value: number }[],
): { label: string; value: number }[] {
  const map = new Map(dist.map((d) => [d.label, d.value]));
  const sumRange = (from: number, to: number) => {
    let n = 0;
    for (let i = from; i <= to; i++) n += map.get(String(i)) || 0;
    return n;
  };
  return [
    { label: "1", value: map.get("1") || 0 },
    { label: "2", value: map.get("2") || 0 },
    { label: "3", value: map.get("3") || 0 },
    { label: "4", value: map.get("4") || 0 },
    { label: "5", value: map.get("5") || 0 },
    { label: "6–8", value: sumRange(6, 8) },
    { label: "9–12", value: sumRange(9, 12) },
    { label: "13+", value: map.get("13+") || 0 },
  ];
}

function stat(value: string, label: string, tone?: "ok" | "warn"): string {
  return `<div class="stat${tone ? ` tone-${tone}` : ""}">
    <div class="stat-v">${escapeHtml(value)}</div>
    <div class="stat-l">${escapeHtml(label)}</div>
  </div>`;
}

function donutSvg(
  entries: { label: string; value: number; color: string }[],
  total: number,
): string {
  const cx = 50;
  const cy = 50;
  const outer = 40;
  const inner = 24;
  const parts = entries.filter((e) => e.value > 0);
  let angle = -Math.PI / 2;

  const polar = (r: number, a: number) => [
    cx + r * Math.cos(a),
    cy + r * Math.sin(a),
  ];

  const arcs = parts
    .map((e) => {
      const sweep = (e.value / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      const large = sweep > Math.PI ? 1 : 0;
      const [x0, y0] = polar(outer, a0);
      const [x1, y1] = polar(outer, a1);
      const [x2, y2] = polar(inner, a1);
      const [x3, y3] = polar(inner, a0);
      const d = [
        `M ${x0} ${y0}`,
        `A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1}`,
        `L ${x2} ${y2}`,
        `A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3}`,
        "Z",
      ].join(" ");

      const mid = a0 + sweep / 2;
      const labelR = (outer + inner) / 2;
      const [lx, ly] = polar(labelR, mid);
      const pct = Math.round((e.value / total) * 1000) / 10;
      const pctLabel =
        pct >= 8
          ? `<text x="${lx.toFixed(2)}" y="${(ly + 1.2).toFixed(2)}"
              text-anchor="middle" dominant-baseline="middle"
              fill="#ffffff" font-size="7" font-weight="700">${
                Number.isInteger(pct) ? pct : pct.toFixed(1)
              }%</text>`
          : "";

      return `<path class="donut-slice" d="${d}" fill="${e.color}"/>${pctLabel}`;
    })
    .join("");

  return `<svg class="donut" viewBox="0 0 100 100" aria-hidden="true">
    ${arcs}
    <circle class="donut-hole" cx="${cx}" cy="${cy}" r="${inner - 0.4}"/>
    <text class="donut-total" x="${cx}" y="${cy + 1.5}" text-anchor="middle" dominant-baseline="middle"
      font-size="12" font-weight="700">${total}</text>
  </svg>`;
}
