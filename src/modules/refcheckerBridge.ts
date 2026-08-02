// @ajan: cursor · @etiket: refchecker, bridge, makale-yazim, k1-ai
/** Thin RefChecker HTTP client (MIT service external). AI tips via K1 8077. */

import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { updateHint } from "../utils/hint";
import {
  fetchLoopbackJson,
  isLoopbackHttpUrl,
  postLoopbackJson,
} from "../utils/loopbackHttp";

export {
  ensureRefcheckerPrefDefaults,
  isRefcheckerEnabled,
  refcheckerMenuChild,
  pingRefcheckerStatus,
  askK1BibliographyTip,
};

const DEFAULT_REFCHECKER = "http://127.0.0.1:8000";
const DEFAULT_K1 = "http://127.0.0.1:8077";

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

function ensureRefcheckerPrefDefaults(): void {
  if (getPref("refchecker.enabled") === undefined) {
    setPref("refchecker.enabled", false);
  }
  if (getPref("refchecker.url") === undefined) {
    setPref("refchecker.url", DEFAULT_REFCHECKER);
  }
  if (getPref("kutuphane.aiUrl") === undefined) {
    setPref("kutuphane.aiUrl", DEFAULT_K1);
  }
}

function isRefcheckerEnabled(): boolean {
  return getPref("refchecker.enabled") === true;
}

function resolveRefcheckerUrl(): string | null {
  const raw = getPref("refchecker.url");
  return isLoopbackHttpUrl(raw) || isLoopbackHttpUrl(DEFAULT_REFCHECKER);
}

function resolveK1Url(): string | null {
  const raw = getPref("kutuphane.aiUrl");
  return isLoopbackHttpUrl(raw) || isLoopbackHttpUrl(DEFAULT_K1);
}

async function pingRefcheckerStatus(): Promise<void> {
  ensureRefcheckerPrefDefaults();
  if (!isRefcheckerEnabled()) {
    alertDialog(getString("refchecker-disabled"));
    return;
  }
  const url = resolveRefcheckerUrl();
  if (!url) {
    alertDialog(getString("refchecker-error-url"));
    return;
  }
  const res = await fetchLoopbackJson(url, "/api/health");
  if (!res.ok) {
    const msg = getString("refchecker-error-unreachable", {
      args: { message: res.error },
    });
    updateHint(msg);
    alertDialog(msg);
    return;
  }
  const msg = getString("refchecker-status-ok", { args: { url } });
  updateHint(msg);
  alertDialog(msg);
}

function openRefcheckerUi(): void {
  const url = resolveRefcheckerUrl();
  if (!url) {
    alertDialog(getString("refchecker-error-url"));
    return;
  }
  try {
    Zotero.launchURL(url);
  } catch (err) {
    ztoolkit.log("RefChecker launch failed", err);
    alertDialog(getString("refchecker-error-open"));
  }
}

async function askK1BibliographyTip(): Promise<void> {
  ensureRefcheckerPrefDefaults();
  const k1 = resolveK1Url();
  if (!k1) {
    alertDialog(getString("k1-ai-error-url"));
    return;
  }

  const status = await fetchLoopbackJson(k1, "/api/llm/status");
  if (!status.ok) {
    alertDialog(
      getString("k1-ai-error-unreachable", { args: { message: status.error } }),
    );
    return;
  }

  const tip = await postLoopbackJson(k1, "/api/llm/chat", {
    mode: "general",
    messages: [
      {
        role: "user",
        content:
          "Brief tip (3 bullets max) for checking a manuscript bibliography before submission: DOI/metadata mismatches, unused cites vs library, fabricated refs. Reply in Turkish.",
      },
    ],
  });
  if (!tip.ok) {
    alertDialog(
      getString("k1-ai-error-chat", { args: { message: tip.error } }),
    );
    return;
  }
  const o = tip.json as Record<string, unknown>;
  const text =
    (typeof o.reply === "string" && o.reply) ||
    (typeof o.content === "string" && o.content) ||
    (typeof o.message === "string" && o.message) ||
    JSON.stringify(o).slice(0, 800);
  updateHint(text);
  alertDialog(`${getString("k1-ai-tip-title")}\n\n${text}`);
}

function refcheckerMenuChild() {
  return {
    tag: "menu" as const,
    label: getString("menu-refchecker"),
    children: [
      {
        tag: "menuitem" as const,
        label: getString("menu-refchecker-status"),
        commandListener: () => {
          void pingRefcheckerStatus();
        },
      },
      {
        tag: "menuitem" as const,
        label: getString("menu-refchecker-open"),
        commandListener: () => openRefcheckerUi(),
      },
      {
        tag: "menuitem" as const,
        label: getString("menu-k1-bib-tip"),
        commandListener: () => {
          void askK1BibliographyTip();
        },
      },
    ],
  };
}
