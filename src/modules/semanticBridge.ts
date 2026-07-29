// @ajan: cursor · @etiket: f9.2.3, semantic, bridge, zotseek
// F9.1–F9.2.3 — Semantic status + vendored index menu.

import { getString } from "../utils/locale";
import { updateHint } from "../utils/hint";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import {
  ensureSemanticPrefDefaults,
  getKutuphaneSemanticStatus,
  isKutuphaneSemanticConfigured,
  isKutuphaneSemanticEnabled,
  isZotSeekSemanticEnabled,
  resolveKutuphaneSemanticUrl,
} from "../utils/kutuphaneSemanticBridge";
import { probeZotSeekStatus } from "../utils/zotseekStatus";
import {
  getVendoredIndexStats,
  indexVendoredItems,
  isVendoredZotSeekReady,
} from "../vendor/zotseek/vendoredSemantic";

export {
  ensureSemanticPrefDefaults,
  semanticMenuChild,
  pingSemanticStatus,
  isSemanticKutuphaneEnabled,
};

function isSemanticKutuphaneEnabled(): boolean {
  return isKutuphaneSemanticEnabled();
}

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

async function formatKutuphaneLine(): Promise<string> {
  if (!isKutuphaneSemanticEnabled()) {
    return getString("semantic-kutuphane-line-off");
  }
  const url = resolveKutuphaneSemanticUrl();
  if (!url || !isKutuphaneSemanticConfigured()) {
    return getString("semantic-error-no-url");
  }
  const status = await getKutuphaneSemanticStatus();
  if (!status) {
    return getString("semantic-error-unreachable");
  }
  return getString("semantic-status", {
    args: {
      ready: status.ready ? "ready" : "not-ready",
      chunks: status.chunkCount ?? 0,
      model: status.model || "—",
      error: status.error || "",
    },
  });
}

async function formatZotSeekLine(): Promise<string> {
  const probe = await probeZotSeekStatus();
  const line = getString(probe.messageKey, {
    args: {
      mode: probe.mode,
      search: probe.canSearch ? "yes" : "no",
      similar: probe.canFindSimilar ? "yes" : "no",
    },
  });
  if (!probe.ready && probe.mode !== "vendored") return line;
  try {
    const stats = await getVendoredIndexStats();
    return (
      line +
      "\n" +
      getString("semantic-vendored-index", {
        args: { count: stats.count, model: stats.modelId },
      })
    );
  } catch {
    return line;
  }
}

async function pingSemanticStatus(): Promise<void> {
  ensureSemanticPrefDefaults();
  const kutuphaneOn = isKutuphaneSemanticEnabled();
  const zotseekOn = isZotSeekSemanticEnabled();

  if (!kutuphaneOn && !zotseekOn) {
    alertDialog(getString("semantic-disabled"));
    return;
  }

  const lines: string[] = [];
  if (kutuphaneOn) {
    lines.push(await formatKutuphaneLine());
  } else {
    lines.push(getString("semantic-kutuphane-line-off"));
  }
  lines.push(await formatZotSeekLine());

  const msg = lines.join("\n");
  updateHint(msg);
  alertDialog(msg);
}

async function indexSelectedForVendored(): Promise<void> {
  ensureSemanticPrefDefaults();
  if (!isZotSeekSemanticEnabled()) {
    alertDialog(getString("semantic-zotseek-disabled"));
    return;
  }
  if (!(await isVendoredZotSeekReady())) {
    alertDialog(getString("zotseek-probe-vendored-stub"));
    return;
  }
  const items =
    getZoteroAdapter()
      .getActivePane()
      ?.getSelectedItems()
      ?.filter((i) => i.isRegularItem()) ?? [];
  if (!items.length) {
    alertDialog(getString("semantic-index-no-selection"));
    return;
  }
  const limited = items.slice(0, 40);
  updateHint(
    getString("semantic-index-progress", { args: { count: limited.length } }),
  );
  const result = await indexVendoredItems(limited.map((i) => i.id));
  const msg = getString("semantic-index-done", {
    args: { ok: result.ok, failed: result.failed },
  });
  updateHint(msg);
  alertDialog(msg);
}

function semanticMenuChild() {
  return {
    tag: "menu" as const,
    label: getString("menu-semantic"),
    children: [
      {
        tag: "menuitem" as const,
        label: getString("menu-semantic-status"),
        commandListener: () => {
          void pingSemanticStatus();
        },
      },
      {
        tag: "menuitem" as const,
        label: getString("menu-semantic-index"),
        commandListener: () => {
          void indexSelectedForVendored();
        },
      },
    ],
  };
}
