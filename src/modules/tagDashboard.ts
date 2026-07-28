import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { isWindowAlive } from "../utils/window";
import {
  TagAnalysisReport,
  analyzeLibraryTags,
} from "../utils/tagAnalysis";

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
    root.innerHTML = renderDashboard(report);
    if (status) {
      status.textContent = getString("tag-dashboard-updated", {
        args: {
          library: report.libraryName,
          time: new Date(report.generatedAt).toLocaleString(),
        },
      });
    }
    wireRefresh(win);
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

function renderDashboard(r: TagAnalysisReport): string {
  const s = r.summary;
  const catEntries = [
    {
      label: getString("tag-dashboard-cat-person"),
      value: s.categories.person,
      color: "var(--tag-blue)",
    },
    {
      label: getString("tag-dashboard-cat-concept"),
      value: s.categories.concept,
      color: "var(--tag-purple)",
    },
    {
      label: getString("tag-dashboard-cat-place"),
      value: s.categories.place,
      color: "var(--tag-green)",
    },
    {
      label: getString("tag-dashboard-cat-system"),
      value: s.categories.system,
      color: "var(--tag-orange)",
    },
  ];
  const catTotal = catEntries.reduce((a, c) => a + c.value, 0) || 1;

  const maxTop = Math.max(...r.topTags.map((t) => t.count), 1);
  const maxDist = Math.max(...r.tagCountDistribution.map((d) => d.value), 1);

  return `
<header class="hero">
  <div>
    <h1>${escapeHtml(getString("tag-dashboard-title"))}</h1>
    <p class="muted">${escapeHtml(
      getString("tag-dashboard-subtitle", {
        args: { library: r.libraryName, items: fmt(s.libraryItems) },
      }),
    )}</p>
  </div>
  <button id="${config.addonRef}-dashboard-refresh" class="btn-refresh" type="button">
    ${escapeHtml(getString("tag-dashboard-refresh"))}
  </button>
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
  ${stat(fmt(s.unusedTags), getString("tag-dashboard-stat-unused"))}
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

<div class="divider"></div>

<h2>${escapeHtml(getString("tag-dashboard-section-types"))}</h2>
<div class="grid-2">
  <article class="card">
    <header class="card-h">${escapeHtml(getString("tag-dashboard-distribution"))}</header>
    <div class="card-b pie-wrap">
      ${donutSvg(catEntries, catTotal)}
      <ul class="legend">
        ${catEntries
          .map(
            (c) => `
          <li><span class="swatch" style="background:${c.color}"></span>
          ${escapeHtml(c.label)} <strong>${fmt(c.value)}</strong></li>`,
          )
          .join("")}
      </ul>
    </div>
  </article>
  <article class="card">
    <header class="card-h">${escapeHtml(getString("tag-dashboard-types-help"))}</header>
    <div class="card-b type-help">
      <p><strong>${escapeHtml(getString("tag-dashboard-cat-person"))}</strong> — ${escapeHtml(getString("tag-dashboard-help-person"))}</p>
      <p><strong>${escapeHtml(getString("tag-dashboard-cat-concept"))}</strong> — ${escapeHtml(getString("tag-dashboard-help-concept"))}</p>
      <p><strong>${escapeHtml(getString("tag-dashboard-cat-place"))}</strong> — ${escapeHtml(getString("tag-dashboard-help-place"))}</p>
      <p><strong>${escapeHtml(getString("tag-dashboard-cat-system"))}</strong> — ${escapeHtml(getString("tag-dashboard-help-system"))}</p>
    </div>
  </article>
</div>

<div class="divider"></div>

<h2>${escapeHtml(getString("tag-dashboard-section-per-item"))}</h2>
<p class="muted small">${escapeHtml(getString("tag-dashboard-per-item-hint"))}</p>
<div class="vbars">
  ${r.tagCountDistribution
    .map((d) => {
      const h = Math.max(4, Math.round((d.value / maxDist) * 160));
      return `<div class="vbar">
        <div class="vbar-col" style="height:${h}px" title="${fmt(d.value)}"></div>
        <span class="vbar-val">${fmt(d.value)}</span>
        <span class="vbar-lab">${escapeHtml(d.label)}</span>
      </div>`;
    })
    .join("")}
</div>

<div class="divider"></div>

<h2>${escapeHtml(getString("tag-dashboard-section-top"))}</h2>
<div class="hbars">
  ${r.topTags
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
<table class="data-table">
  <thead><tr><th>${escapeHtml(getString("tag-dashboard-col-tag"))}</th><th>${escapeHtml(getString("tag-dashboard-col-count"))}</th></tr></thead>
  <tbody>
    ${r.topTags
      .map(
        (t) =>
          `<tr><td>${escapeHtml(t.name)}</td><td>${fmt(t.count)}</td></tr>`,
      )
      .join("")}
  </tbody>
</table>

<div class="divider"></div>

<h2>${escapeHtml(getString("tag-dashboard-section-merge"))}</h2>
<div class="grid-2">
  <article class="card">
    <header class="card-h">
      <span>${escapeHtml(getString("tag-dashboard-fold-title"))}</span>
      <span class="pill pill-warn">${fmt(r.foldDupes.length)}</span>
    </header>
    <div class="card-b list">
      ${
        r.foldDupes.length
          ? r.foldDupes
              .map((g) =>
                escapeHtml(
                  g.map((t) => `${t.name}(${t.count})`).join(" → "),
                ),
              )
              .map((line) => `<div class="list-row">${line}</div>`)
              .join("")
          : `<div class="muted">${escapeHtml(getString("tag-dashboard-none"))}</div>`
      }
    </div>
  </article>
  <div class="stack">
    <article class="card">
      <header class="card-h">${escapeHtml(getString("tag-dashboard-bilingual-title"))}</header>
      <div class="card-b list">
        ${
          r.bilingualPairs.length
            ? r.bilingualPairs
                .map(
                  (p) =>
                    `<div class="list-row">${escapeHtml(
                      `${p.en.name}(${p.en.count}) → ${p.tr.name}(${p.tr.count})`,
                    )}</div>`,
                )
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
                .map(
                  (f) => `<div class="list-row fuzzy">
                    <span class="pill">${f.score}</span>
                    <span>${escapeHtml(
                      `${f.a.name}(${f.a.count}) ↔ ${f.b.name}(${f.b.count})`,
                    )}</span>
                  </div>`,
                )
                .join("")
            : `<div class="muted">${escapeHtml(getString("tag-dashboard-none"))}</div>`
        }
        <p class="muted small fuzzy-note">${escapeHtml(getString("tag-dashboard-fuzzy-note"))}</p>
      </div>
    </article>
  </div>
</div>

<div class="callout callout-ok">
  ${escapeHtml(getString("tag-dashboard-recommendation"))}
</div>
`;
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
  const r = 15.9155;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = entries
    .filter((e) => e.value > 0)
    .map((e) => {
      const len = (e.value / total) * c;
      const dash = `${len} ${c - len}`;
      const el = `<circle class="donut-seg" cx="21" cy="21" r="${r}"
        fill="transparent" stroke="${e.color}" stroke-width="6"
        stroke-dasharray="${dash}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 21 21)"></circle>`;
      offset += len;
      return el;
    })
    .join("");
  return `<svg class="donut" viewBox="0 0 42 42" aria-hidden="true">
    <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="var(--tag-track)" stroke-width="6"></circle>
    ${arcs}
    <circle cx="21" cy="21" r="10" fill="var(--tag-card)"></circle>
  </svg>`;
}
