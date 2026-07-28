import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { isWindowAlive } from "../utils/window";
import { updateHint } from "../utils/hint";
import {
  TagAnalysisReport,
  analyzeLibraryTags,
} from "../utils/tagAnalysis";
import { mergeTags, deleteTags } from "../utils/tagActions";

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
    wireActions(win, report);
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

  const topTags = r.topTags.slice(0, 10);
  const maxTop = Math.max(...topTags.map((t) => t.count), 1);
  const dist = compressDistribution(r.tagCountDistribution);
  const maxDist = Math.max(...dist.map((d) => d.value), 1);

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

<div class="grid-2">
  <article class="card">
    <header class="card-h">${escapeHtml(getString("tag-dashboard-section-types"))}</header>
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
                const line = escapeHtml(
                  g.map((t) => `${t.name}(${t.count})`).join(" → "),
                );
                return `<div class="list-row fold-row">
                  <span class="fold-line" title="${line}">${line}</span>
                  <button type="button" class="btn-mini btn-merge-fold" data-fold-index="${i}">${escapeHtml(
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
    <header class="card-h">${escapeHtml(getString("tag-dashboard-bilingual-title"))}</header>
    <div class="card-b list">
      ${
        r.bilingualPairs.length
          ? r.bilingualPairs
              .map((p, i) => {
                const line = escapeHtml(
                  `${p.en.name}(${p.en.count}) → ${p.tr.name}(${p.tr.count})`,
                );
                return `<div class="list-row bilingual-row">
                  <span title="${line}">${line}</span>
                  <button type="button" class="btn-mini btn-merge-bilingual" data-bilingual-index="${i}">${escapeHtml(
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

<article class="card">
  <header class="card-h">${escapeHtml(getString("tag-dashboard-manual-title"))}</header>
  <div class="card-b">
    <div class="manual-row">
      <input type="text" id="${config.addonRef}-manual-merge-from" placeholder="${escapeHtml(
        getString("tag-dashboard-manual-merge-from-placeholder"),
      )}" />
      <input type="text" id="${config.addonRef}-manual-merge-to" placeholder="${escapeHtml(
        getString("tag-dashboard-manual-merge-to-placeholder"),
      )}" />
      <button type="button" id="${config.addonRef}-manual-merge-btn" class="btn-mini">${escapeHtml(
        getString("tag-dashboard-action-merge"),
      )}</button>
    </div>
    <div class="manual-row">
      <input type="text" id="${config.addonRef}-manual-delete" placeholder="${escapeHtml(
        getString("tag-dashboard-manual-delete-placeholder"),
      )}" />
      <button type="button" id="${config.addonRef}-manual-delete-btn" class="btn-mini btn-danger">${escapeHtml(
        getString("tag-dashboard-action-delete"),
      )}</button>
    </div>
    <p class="muted small">${escapeHtml(getString("tag-dashboard-manual-hint"))}</p>
  </div>
</article>

<table class="data-table">
  <thead><tr><th>${escapeHtml(getString("tag-dashboard-col-tag"))}</th><th>${escapeHtml(getString("tag-dashboard-col-count"))}</th></tr></thead>
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

<div class="callout callout-ok">
  ${escapeHtml(getString("tag-dashboard-recommendation"))}
</div>
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
  const r = 15.9155;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = entries
    .filter((e) => e.value > 0)
    .map((e) => {
      const len = (e.value / total) * c;
      const dash = `${len} ${c - len}`;
      const el = `<circle class="donut-seg" cx="21" cy="21" r="${r}"
        fill="transparent" stroke="${e.color}" stroke-width="5.5"
        stroke-dasharray="${dash}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 21 21)"></circle>`;
      offset += len;
      return el;
    })
    .join("");
  return `<svg class="donut" viewBox="0 0 42 42" aria-hidden="true">
    <circle cx="21" cy="21" r="${r}" fill="transparent" stroke="var(--tag-track)" stroke-width="5.5"></circle>
    ${arcs}
    <circle cx="21" cy="21" r="11" fill="var(--tag-card)"></circle>
  </svg>`;
}
