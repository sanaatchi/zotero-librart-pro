// @ajan: cursor · @etiket: f7, anki, bridge, menu
// LibRart → AnkiConnect bridge. Protocol inspired by yanki-connect (MIT).

import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { updateHint } from "../utils/hint";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import {
  AnkiConnectClient,
  zoteroAnkiTransport,
} from "../vendor/yanki-connect/ankiConnectClient";
import {
  ANKI_TAG,
  AnkiLinkData,
  buildBasicFields,
  decideNoteId,
  findNotesQuery,
  itemKeyTag,
  parseAnkiLink,
  writeAnkiLink,
} from "../vendor/yanki-connect/ankiNotePayload";

export {
  isAnkiEnabled,
  ensureAnkiPrefDefaults,
  ankiMenuChild,
  sendSelectedItemsToAnki,
  createAnkiClientFromPrefs,
  syncItemToAnki,
};

function isAnkiEnabled(): boolean {
  return getPref("anki.enabled") === true;
}

function ensureAnkiPrefDefaults(): void {
  if (getPref("anki.enabled") === undefined) setPref("anki.enabled", false);
  if (getPref("anki.host") === undefined)
    setPref("anki.host", "http://127.0.0.1");
  if (getPref("anki.port") === undefined) setPref("anki.port", 8765);
  if (getPref("anki.key") === undefined) setPref("anki.key", "");
  if (getPref("anki.deckName") === undefined)
    setPref("anki.deckName", "LibRart");
  if (getPref("anki.modelName") === undefined)
    setPref("anki.modelName", "Basic");
}

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

function readStringPref(key: string, fallback: string): string {
  const v = getPref(key);
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function readPortPref(): number {
  const v = getPref("anki.port");
  if (typeof v === "number" && Number.isFinite(v) && v > 0)
    return Math.floor(v);
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 8765;
}

function createAnkiClientFromPrefs(): AnkiConnectClient {
  const key = readStringPref("anki.key", "");
  return new AnkiConnectClient({
    host: readStringPref("anki.host", "http://127.0.0.1"),
    port: readPortPref(),
    key: key || undefined,
    transport: (url, body) => zoteroAnkiTransport(url, body),
  });
}

function formatCreators(item: Zotero.Item): string {
  try {
    const creators = item.getCreators?.() ?? [];
    return creators
      .slice(0, 8)
      .map((c) => {
        const last = (c.lastName || "").trim();
        const first = (c.firstName || "").trim();
        if (last && first) return `${last}, ${first}`;
        const named = (c as { name?: string }).name || "";
        return last || first || named.trim();
      })
      .filter(Boolean)
      .join("; ");
  } catch {
    return "";
  }
}

function itemToFields(item: Zotero.Item) {
  return {
    key: item.key,
    title: String(item.getField("title") || ""),
    creators: formatCreators(item),
    year: String(item.getField("year") || item.getField("date") || "").slice(
      0,
      4,
    ),
    abstractNote: String(item.getField("abstractNote") || ""),
    doi: String(item.getField("DOI") || ""),
  };
}

async function persistAnkiLink(
  item: Zotero.Item,
  data: AnkiLinkData,
): Promise<void> {
  const extra = String(item.getField("extra") || "");
  item.setField("extra", writeAnkiLink(extra, data));
  try {
    item.addTag(ANKI_TAG);
    item.addTag(itemKeyTag(item.key));
  } catch {
    /* tags optional */
  }
  await item.saveTx();
}

async function syncItemToAnki(
  item: Zotero.Item,
  client: AnkiConnectClient,
  deckName: string,
  modelName: string,
): Promise<"created" | "updated"> {
  const fields = buildBasicFields(itemToFields(item));
  const tags = [ANKI_TAG, itemKeyTag(item.key)];
  const linked = parseAnkiLink(String(item.getField("extra") || ""));
  let found: number[] = [];
  if (!linked?.noteId) {
    found = await client.findNotes(findNotesQuery(item.key));
  }
  const noteId = decideNoteId(linked?.noteId, found);

  let finalId: number;
  let action: "created" | "updated";
  if (noteId) {
    await client.updateNoteFields({ id: noteId, fields });
    finalId = noteId;
    action = "updated";
  } else {
    await client.createDeck(deckName);
    const created = await client.addNote({
      deckName,
      modelName,
      fields,
      tags,
      options: { allowDuplicate: false },
    });
    if (!created) {
      throw new Error(`addNote returned null for ${item.key}`);
    }
    finalId = created;
    action = "created";
  }

  await persistAnkiLink(item, {
    v: 1,
    noteId: finalId,
    deck: deckName,
    model: modelName,
    updatedAt: Date.now(),
  });
  return action;
}

async function sendSelectedItemsToAnki(): Promise<void> {
  ensureAnkiPrefDefaults();
  if (!isAnkiEnabled()) {
    alertDialog(getString("anki-disabled"));
    return;
  }

  const selected =
    getZoteroAdapter()
      .getActivePane()
      ?.getSelectedItems()
      ?.filter((i) => i.isRegularItem()) ?? [];

  if (!selected.length) {
    alertDialog(getString("anki-error-no-item"));
    return;
  }

  const deckName = readStringPref("anki.deckName", "LibRart");
  const modelName = readStringPref("anki.modelName", "Basic");
  const client = createAnkiClientFromPrefs();

  try {
    await client.versionProbe();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    alertDialog(
      getString("anki-error-unreachable", { args: { message: msg } }),
    );
    return;
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  updateHint(getString("anki-progress", { args: { count: selected.length } }));

  for (const item of selected) {
    try {
      const result = await syncItemToAnki(item, client, deckName, modelName);
      if (result === "created") created += 1;
      else updated += 1;
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${item.key}: ${msg}`);
    }
  }

  const summary = getString("anki-done", {
    args: { created, updated, failed },
  });
  updateHint(summary);
  if (failed && errors.length) {
    alertDialog(`${summary}\n\n${errors.slice(0, 5).join("\n")}`);
  }
}

function ankiMenuChild() {
  return {
    tag: "menuitem" as const,
    label: getString("menu-anki-send"),
    commandListener: () => {
      void sendSelectedItemsToAnki();
    },
  };
}
