// @ajan: cursor · @etiket: f3, docx-cited, bridge, stale-tag-sweep
// Adapted from zotero-tag-cited (MIT) tagCited.js

import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { updateHint } from "../utils/hint";
import {
  buildCitedTag,
  extractCitationUrisFromDocumentXml,
} from "../utils/docxCitedParse";

export {
  runDocxCitedTagging,
  docxCitedMenuChild,
  isDocxCitedEnabled,
  seedCitedByLibrary,
};

const REGISTRY_PREF = "docxCited.registry";

type DocxCitedRegistry = Record<string, string>;

type RefreshResult = { added: number; removed: number; unchanged: number };

function isDocxCitedEnabled(): boolean {
  const v = getPref("docxCited.enabled");
  return v === undefined || v === true;
}

function loadRegistry(): DocxCitedRegistry {
  const raw = getPref(REGISTRY_PREF);
  if (!raw || typeof raw !== "string") return {};
  try {
    return JSON.parse(raw) as DocxCitedRegistry;
  } catch {
    return {};
  }
}

function saveRegistry(registry: DocxCitedRegistry): void {
  setPref(REGISTRY_PREF, JSON.stringify(registry));
}

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

function promptSuffix(window: Window): string | null {
  const Services = ztoolkit.getGlobal("Services") as {
    prompt: {
      prompt: (
        win: Window,
        title: string,
        message: string,
        input: { value: string },
        checkbox: null,
        checkState: { value: boolean },
      ) => boolean;
    };
  };
  const input = { value: "" };
  const checkState = { value: false };
  const ok = Services.prompt.prompt(
    window,
    getString("docx-cited-title"),
    getString("docx-cited-suffix-prompt"),
    input,
    null,
    checkState,
  );
  const suffix = input.value.trim();
  return ok && suffix ? suffix : null;
}

async function getOrCreateTagForPath(
  window: Window,
  filePath: string,
): Promise<string | null> {
  const registry = loadRegistry();
  if (registry[filePath]) return registry[filePath];
  const suffix = promptSuffix(window);
  if (!suffix) return null;
  const tag = buildCitedTag(suffix);
  registry[filePath] = tag;
  saveRegistry(registry);
  return tag;
}

async function readDocumentXml(filePath: string): Promise<string> {
  const nsIFile = Zotero.File.pathToFile(filePath);
  const zipReader = (
    Components.classes as Record<
      string,
      { createInstance: (iid: unknown) => unknown }
    >
  )["@mozilla.org/libjar/zip-reader;1"].createInstance(
    Components.interfaces.nsIZipReader,
  ) as {
    open: (file: nsIFile) => void;
    close: () => void;
    hasEntry: (name: string) => boolean;
    getInputStream: (name: string) => nsIInputStream;
  };
  try {
    zipReader.open(nsIFile);
    if (!zipReader.hasEntry("word/document.xml")) {
      throw new Error("missing word/document.xml");
    }
    const inputStream = zipReader.getInputStream("word/document.xml");
    const bstream = (
      Components.classes as Record<
        string,
        { createInstance: (iid: unknown) => unknown }
      >
    )["@mozilla.org/binaryinputstream;1"].createInstance(
      Components.interfaces.nsIBinaryInputStream,
    ) as {
      setInputStream: (stream: nsIInputStream) => void;
      available: () => number;
      readByteArray: (count: number) => number[];
    };
    bstream.setInputStream(inputStream);
    const bytes = bstream.readByteArray(bstream.available());
    return new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
  } finally {
    zipReader.close();
  }
}

async function parseDocxUris(filePath: string): Promise<string[]> {
  const xml = await readDocumentXml(filePath);
  return extractCitationUrisFromDocumentXml(xml);
}

async function resolveItems(uris: Iterable<string>): Promise<Zotero.Item[]> {
  const items: Zotero.Item[] = [];
  for (const uri of uris) {
    try {
      const item = await Zotero.URI.getURIItem(uri);
      if (item && !item.deleted) items.push(item);
    } catch (err) {
      ztoolkit.log("docxCited URI resolve failed", uri, err);
    }
  }
  return items;
}

async function getTaggedItemIDs(
  tag: string,
  libraryID: number,
): Promise<Set<number>> {
  const s = new Zotero.Search({ libraryID }) as Zotero.Search;
  s.addCondition("tag", "is", tag);
  const ids = await s.search();
  return new Set(ids);
}

async function ensureSavedSearch(
  tag: string,
  libraryID: number,
): Promise<void> {
  const existing = (
    Zotero.Searches as unknown as {
      getByLibrary: (id: number) => Zotero.Search[];
    }
  ).getByLibrary(libraryID);
  if (existing.some((search) => search.name === tag)) return;
  const s = new Zotero.Search({ libraryID }) as Zotero.Search;
  s.name = tag;
  s.addCondition("tag", "is", tag);
  await s.saveTx();
}

async function refreshTag(
  tag: string,
  citedItems: Zotero.Item[],
): Promise<RefreshResult> {
  // Libraries that already carry this tag must be visited even if this DOCX
  // pass cites nothing there — otherwise group-library tags go stale forever.
  const librariesNeedingSweep: number[] = [];
  const getAll = (
    Zotero.Libraries as unknown as {
      getAll?: () => Array<{ libraryID?: number; id?: number }>;
    }
  ).getAll;
  if (typeof getAll === "function") {
    for (const lib of getAll.call(Zotero.Libraries) || []) {
      const libraryID = Number(lib.libraryID ?? lib.id);
      if (!Number.isFinite(libraryID)) continue;
      if (libraryID === Zotero.Libraries.userLibraryID) continue;
      if (citedItems.some((item) => item.libraryID === libraryID)) continue;
      const tagged = await getTaggedItemIDs(tag, libraryID);
      if (tagged.size > 0) librariesNeedingSweep.push(libraryID);
    }
  }

  const citedByLibrary = seedCitedByLibrary(
    citedItems,
    Zotero.Libraries.userLibraryID,
    librariesNeedingSweep,
  );

  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const [libraryID, citedIDs] of citedByLibrary) {
    const taggedIDs = await getTaggedItemIDs(tag, libraryID);
    await Zotero.DB.executeTransaction(async () => {
      for (const id of citedIDs) {
        if (taggedIDs.has(id)) continue;
        const item = await Zotero.Items.getAsync(id);
        if (item.addTag(tag, 1)) {
          await item.save();
          added++;
        }
      }
      for (const id of taggedIDs) {
        if (citedIDs.has(id)) {
          unchanged++;
          continue;
        }
        const item = await Zotero.Items.getAsync(id);
        if (item.removeTag(tag)) {
          await item.save();
          removed++;
        }
      }
    });
    await ensureSavedSearch(tag, libraryID);
  }

  return { added, removed, unchanged };
}

/**
 * Build library → cited item IDs. Always includes userLibraryID.
 * `librariesNeedingSweep` gets an empty set so prior tags are cleared.
 */
function seedCitedByLibrary(
  citedItems: Array<{ id: number; libraryID: number }>,
  userLibraryID: number,
  librariesNeedingSweep: number[] = [],
): Map<number, Set<number>> {
  const citedByLibrary = new Map<number, Set<number>>();
  for (const item of citedItems) {
    if (!citedByLibrary.has(item.libraryID)) {
      citedByLibrary.set(item.libraryID, new Set());
    }
    citedByLibrary.get(item.libraryID)!.add(item.id);
  }
  if (!citedByLibrary.has(userLibraryID)) {
    citedByLibrary.set(userLibraryID, new Set());
  }
  for (const libraryID of librariesNeedingSweep) {
    if (!citedByLibrary.has(libraryID)) {
      citedByLibrary.set(libraryID, new Set());
    }
  }
  return citedByLibrary;
}

async function runDocxCitedTagging(window: Window): Promise<void> {
  if (!isDocxCitedEnabled()) return;

  const path = await new ztoolkit.FilePicker(
    getString("docx-cited-file-title"),
    "open",
    [["Word Document", "*.docx"]],
    "manuscript.docx",
    window,
    "text",
  ).open();
  if (!path) return;

  const tag = await getOrCreateTagForPath(window, path);
  if (!tag) return;

  let uris: string[];
  try {
    uris = await parseDocxUris(path);
  } catch (err) {
    alertDialog(
      getString("docx-cited-read-error", {
        args: { message: String(err) },
      }),
    );
    return;
  }

  const citedItems = await resolveItems(uris);
  const result = await refreshTag(tag, citedItems);
  const summary = getString("docx-cited-done", {
    args: {
      tag,
      added: String(result.added),
      removed: String(result.removed),
      unchanged: String(result.unchanged),
    },
  });
  updateHint(summary);
  alertDialog(summary);
}

function docxCitedMenuChild() {
  return {
    tag: "menuitem" as const,
    label: getString("menu-docx-cited"),
    commandListener: () => {
      const win = Zotero.getMainWindow();
      if (win) runDocxCitedTagging(win);
    },
  };
}
