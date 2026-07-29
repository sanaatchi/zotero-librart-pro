// @ajan: cursor · @etiket: citegeist, bridge, menu
// Thin Citegeist-style OpenAlex citation summary (opt-in). No full GPL UI port.

import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { updateHint } from "../utils/hint";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import { normalizeOpenAlexDoi } from "../vendor/zotero-citation-maps/openAlexDataSource";
import {
  buildOpenAlexWorkByDoiUrl,
  formatCitegeistSummaryLines,
  slimCitegeistWork,
  type CitegeistLookupResult,
} from "../utils/citegeistMetrics";

export {
  isCitegeistEnabled,
  ensureCitegeistPrefDefaults,
  citegeistMenuChild,
  summarizeSelectedItemsCitegeist,
};

function isCitegeistEnabled(): boolean {
  return getPref("citegeist.enabled") === true;
}

function ensureCitegeistPrefDefaults(): void {
  if (getPref("citegeist.enabled") === undefined) {
    setPref("citegeist.enabled", false);
  }
}

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

function getMailto(): string {
  const v = getPref("openalex.mailto");
  return typeof v === "string" ? v.trim() : "";
}

async function httpGetJSON(url: string): Promise<unknown> {
  const req = await Zotero.HTTP.request("GET", url, {
    headers: { Accept: "application/json" },
    timeout: 30000,
  });
  return JSON.parse(req.responseText);
}

async function lookupItem(item: Zotero.Item): Promise<CitegeistLookupResult> {
  const title =
    (item.getField("title") as string) || item.getDisplayTitle?.() || "—";
  const doi = normalizeOpenAlexDoi((item.getField("DOI") as string) || "");
  if (!doi) {
    return { ok: false, title, doi: null, reason: "no-doi" };
  }
  try {
    const url = buildOpenAlexWorkByDoiUrl(doi, getMailto());
    const payload = (await httpGetJSON(url)) as { results?: unknown[] };
    const first = Array.isArray(payload?.results) ? payload.results[0] : null;
    const metrics = slimCitegeistWork(first);
    if (!metrics) {
      return { ok: false, title, doi, reason: "not-found" };
    }
    return {
      ok: true,
      metrics: { ...metrics, title: metrics.title || title, doi },
    };
  } catch {
    return { ok: false, title, doi, reason: "error" };
  }
}

async function summarizeSelectedItemsCitegeist(): Promise<void> {
  ensureCitegeistPrefDefaults();
  if (!isCitegeistEnabled()) {
    alertDialog(getString("citegeist-disabled"));
    return;
  }

  const items =
    getZoteroAdapter()
      .getActivePane()
      ?.getSelectedItems()
      ?.filter((i) => i.isRegularItem()) ?? [];
  if (!items.length) {
    alertDialog(getString("citegeist-error-no-selection"));
    return;
  }

  const limited = items.slice(0, 8);
  updateHint(
    getString("citegeist-progress", { args: { count: limited.length } }),
  );
  const results: CitegeistLookupResult[] = [];
  for (let i = 0; i < limited.length; i++) {
    results.push(await lookupItem(limited[i]));
    if (i + 1 < limited.length) {
      await Zotero.Promise.delay(200);
    }
  }

  const lines = formatCitegeistSummaryLines(results, {
    noDoi: getString("citegeist-reason-no-doi"),
    notFound: getString("citegeist-reason-not-found"),
    error: getString("citegeist-reason-error"),
    ok: (m) =>
      getString("citegeist-line-ok", {
        args: {
          title: m.title,
          year: m.year != null ? String(m.year) : "—",
          cited: m.citedByCount,
          refs: m.referencedWorksCount,
        },
      }),
  });
  const msg = getString("citegeist-summary-title") + "\n\n" + lines.join("\n");
  updateHint(lines[0] || getString("citegeist-summary-title"));
  alertDialog(msg);
}

function citegeistMenuChild() {
  return {
    tag: "menuitem" as const,
    label: getString("menu-citegeist-summary"),
    commandListener: () => {
      void summarizeSelectedItemsCitegeist();
    },
  };
}
