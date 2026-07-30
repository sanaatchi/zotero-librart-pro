// @ajan: cursor · @etiket: f9, semantic, kutuphane, bridge, connection-graph
// Kutuphane anlamsal köprü (8756) — HTTP + KP / z:KEY eşleştirme.

import { getPref, setPref } from "./prefs";
import { getCitationKeyFromExtra } from "./citationKey";
import {
  buildKpIndexFromEntries,
  mapHitsToItemIds,
  normalizeSemanticBaseUrl,
  parseSearchPayload,
  parseStatusPayload,
  parseConnectionGraphPayload,
  SemanticSearchHit,
  SemanticStatusPayload,
  type KutuphaneConnectionGraphPayload,
} from "./kutuphaneSemanticParse";

export {
  isKutuphaneSemanticEnabled,
  isKutuphaneSemanticConfigured,
  isKutuphaneSemanticReady,
  getKutuphaneSemanticStatus,
  searchKutuphaneSemantic,
  buildKpIndex,
  ensureSemanticPrefDefaults,
  isZotSeekSemanticEnabled,
  resolveKutuphaneSemanticUrl,
  isKutuphaneGraphLayerEnabled,
  fetchKutuphaneConnectionGraph,
};

export type KutuphaneHit = SemanticSearchHit;

const DEFAULT_URL = "http://127.0.0.1:8756";

function isKutuphaneGraphLayerEnabled(): boolean {
  if (getPref("semantic.kutuphane.graph.enabled") === false) return false;
  return isKutuphaneSemanticEnabled();
}

async function fetchKutuphaneConnectionGraph(): Promise<KutuphaneConnectionGraphPayload | null> {
  const url = baseUrl();
  if (!url || !isKutuphaneGraphLayerEnabled()) return null;
  try {
    const xhr = await Zotero.HTTP.request("GET", `${url}/connection-graph`, {
      timeout: 15000,
      responseType: "text",
    });
    const raw = JSON.parse(String(xhr.responseText ?? ""));
    return parseConnectionGraphPayload(raw);
  } catch (e) {
    ztoolkit.log("Kutuphane connection-graph fetch failed", e);
    return null;
  }
}

function ensureSemanticPrefDefaults(): void {
  const legacy = getPref("kutuphaneSemanticUrl");
  const legacyUrl =
    typeof legacy === "string" && legacy.trim() ? legacy.trim() : "";

  if (getPref("semantic.kutuphaneUrl") === undefined) {
    setPref("semantic.kutuphaneUrl", legacyUrl || DEFAULT_URL);
  }
  if (getPref("semantic.kutuphane.enabled") === undefined) {
    // Preserve prior behavior: non-empty legacy URL meant "on".
    setPref("semantic.kutuphane.enabled", Boolean(legacyUrl));
  }
  if (getPref("semantic.zotseek.enabled") === undefined) {
    setPref("semantic.zotseek.enabled", false);
  }
}

function isKutuphaneSemanticEnabled(): boolean {
  return getPref("semantic.kutuphane.enabled") === true;
}

function isZotSeekSemanticEnabled(): boolean {
  return getPref("semantic.zotseek.enabled") === true;
}

function resolveKutuphaneSemanticUrl(): string | null {
  const modern = normalizeSemanticBaseUrl(getPref("semantic.kutuphaneUrl"));
  if (modern) return modern;
  return normalizeSemanticBaseUrl(getPref("kutuphaneSemanticUrl"));
}

function baseUrl(): string | null {
  if (!isKutuphaneSemanticEnabled()) return null;
  return resolveKutuphaneSemanticUrl();
}

function isKutuphaneSemanticConfigured(): boolean {
  return !!baseUrl();
}

async function getKutuphaneSemanticStatus(): Promise<SemanticStatusPayload | null> {
  const url = baseUrl();
  if (!url) return null;
  try {
    const xhr = await Zotero.HTTP.request("GET", `${url}/status`, {
      timeout: 3000,
      responseType: "text",
    });
    const raw = JSON.parse(String(xhr.responseText ?? ""));
    return parseStatusPayload(raw);
  } catch (e) {
    ztoolkit.log("Kutuphane semantic status check failed", e);
    return {
      ready: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Live readiness check — Ollama reachable + chunks indexed, per /status. */
async function isKutuphaneSemanticReady(): Promise<boolean> {
  const status = await getKutuphaneSemanticStatus();
  return !!status?.ready;
}

async function searchKutuphaneSemantic(
  query: string,
  options: { topK?: number; minSimilarity?: number } = {},
): Promise<KutuphaneHit[]> {
  const url = baseUrl();
  if (!url) return [];
  const clean = query.trim();
  if (!clean) return [];
  try {
    const xhr = await Zotero.HTTP.request("POST", `${url}/search`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: clean,
        topK: options.topK ?? 8,
        minSimilarity: options.minSimilarity ?? 0.5,
      }),
      timeout: 20000,
      responseType: "text",
    });
    const raw = JSON.parse(String(xhr.responseText ?? ""));
    return parseSearchPayload(raw);
  } catch (e) {
    ztoolkit.log("Kutuphane semantic search failed", e);
    return [];
  }
}

/**
 * Build KP… / z:KEY → itemID map (Citation Key Extra + Zotero item.key).
 */
function buildKpIndex(itemIDs: Iterable<number>): Map<string, number> {
  const entries: Array<{
    itemId: number;
    citationKey: string | null;
    zoteroKey: string | null;
  }> = [];
  for (const id of itemIDs) {
    const item = Zotero.Items.get(id);
    if (!item) continue;
    entries.push({
      itemId: id,
      citationKey: getCitationKeyFromExtra(item),
      zoteroKey: typeof item.key === "string" ? item.key : null,
    });
  }
  return buildKpIndexFromEntries(entries);
}

export { mapHitsToItemIds };
