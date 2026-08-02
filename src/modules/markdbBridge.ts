// @ajan: cursor · @etiket: f8, markdb, bridge, menu, ux, makale-yazim
// Obsidian/MarkDB vault → Bağlantı Haritası note edges + tag sync + open.
// Scan patterns adapted from zotero-markdb-connect (MIT). Open URI / tag sync
// inspired by mdbcUX.ts / mdbcScan.ts (MIT) — selective clean-room.

import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { updateHint } from "../utils/hint";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import {
  GraphEdge,
  GraphNode,
  isCrossDiscipline,
  makeEdgeId,
} from "../utils/connectionGraph";
import {
  buildMarkdbEdgeCandidates,
  extractCitationKeyFromExtra,
  MarkdbIdMaps,
} from "../vendor/markdb/markdbMatch";
import {
  isMarkdownNoteFilename,
  parseMarkdownNote,
} from "../vendor/markdb/markdbScan";
import type {
  MarkdbMatchStrategy,
  MarkdbParsedNote,
} from "../vendor/markdb/markdbTypes";

export {
  isMarkdbEnabled,
  ensureMarkdbPrefDefaults,
  markdbMenuChild,
  computeMarkdbNoteEdges,
  scanVaultMarkdownNotes,
  buildIdMapsFromNodes,
  getMarkdbVaultPath,
  getMarkdbMatchStrategy,
  openMarkdbNoteForSelection,
  syncMarkdbTagsFromVault,
};

const MAX_VAULT_FILES = 2500;
const DEFAULT_TAG = "mdbc";

/** Last successful vault match: itemID → note absolute paths. */
let lastNotePathsByItemId = new Map<number, string[]>();

function isMarkdbEnabled(): boolean {
  return getPref("note.markdb.enabled") === true;
}

function ensureMarkdbPrefDefaults(): void {
  if (getPref("note.markdb.enabled") === undefined) {
    setPref("note.markdb.enabled", false);
  }
  if (getPref("note.markdb.vaultPath") === undefined) {
    setPref("note.markdb.vaultPath", "");
  }
  if (getPref("note.markdb.matchStrategy") === undefined) {
    setPref("note.markdb.matchStrategy", "citekeyyaml");
  }
  if (getPref("note.markdb.tag") === undefined) {
    setPref("note.markdb.tag", DEFAULT_TAG);
  }
}

function getMarkdbVaultPath(): string {
  const v = getPref("note.markdb.vaultPath");
  return typeof v === "string" ? v.trim() : "";
}

function getMarkdbMatchStrategy(): MarkdbMatchStrategy {
  const v = getPref("note.markdb.matchStrategy");
  if (v === "zotitemkey") return "zotitemkey";
  return "citekeyyaml";
}

function getMarkdbTag(): string {
  const v = getPref("note.markdb.tag");
  const t = typeof v === "string" ? v.trim() : "";
  return t || DEFAULT_TAG;
}

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

type DirEntry = { name: string; path: string };

async function listDirContents(dirpath: string): Promise<DirEntry[]> {
  const items: DirEntry[] = [];
  try {
    await Zotero.File.iterateDirectory(dirpath, (item: DirEntry) => {
      if (!item.name.startsWith(".")) items.push(item);
    });
  } catch (err) {
    ztoolkit.log("MarkDB listDirContents failed", dirpath, err);
  }
  return items;
}

async function* listFilesRecursively(
  dirpath: string,
): AsyncGenerator<DirEntry> {
  const entries = await listDirContents(dirpath);
  for (const entry of entries) {
    try {
      const zfile = Zotero.File.pathToFile(entry.path);
      if (
        !zfile.exists() ||
        !zfile.isReadable() ||
        zfile.isHidden() ||
        zfile.isSpecial() ||
        zfile.isSymlink()
      ) {
        continue;
      }
      if (zfile.isDirectory()) {
        yield* listFilesRecursively(entry.path);
      } else if (zfile.isFile()) {
        yield entry;
      }
    } catch (err) {
      ztoolkit.log("MarkDB recurse failed", entry.path, err);
    }
  }
}

async function collectMarkdownFiles(vaultPath: string): Promise<DirEntry[]> {
  const base = Zotero.File.pathToFile(vaultPath);
  if (!base.exists() || !base.isDirectory()) {
    throw new Error(`Vault path invalid: ${vaultPath}`);
  }
  base.normalize();
  const files: DirEntry[] = [];
  for await (const file of listFilesRecursively(base.path)) {
    if (!isMarkdownNoteFilename(file.name)) continue;
    files.push(file);
    if (files.length >= MAX_VAULT_FILES) break;
  }
  return files;
}

async function scanVaultMarkdownNotes(
  vaultPath: string,
  strategy: MarkdbMatchStrategy = "citekeyyaml",
): Promise<MarkdbParsedNote[]> {
  if (!vaultPath.trim()) return [];
  const files = await collectMarkdownFiles(vaultPath);
  const notes: MarkdbParsedNote[] = [];
  for (const file of files) {
    try {
      const raw = await Zotero.File.getContentsAsync(file.path);
      const content = raw && typeof raw === "string" ? raw : "";
      notes.push(parseMarkdownNote(file.name, file.path, content, strategy));
    } catch (err) {
      ztoolkit.log("MarkDB read failed", file.path, err);
    }
  }
  return notes;
}

function buildIdMapsFromNodes(nodes: Map<number, GraphNode>): MarkdbIdMaps {
  const citekeyToItemId = new Map<string, number>();
  const itemKeyToItemId = new Map<string, number>();

  for (const node of nodes.values()) {
    itemKeyToItemId.set(node.key.toUpperCase(), node.itemID);
    try {
      const item = Zotero.Items.get(node.itemID);
      if (!item) continue;
      const extra = String(item.getField("extra") || "");
      const ck = extractCitationKeyFromExtra(extra);
      if (ck) citekeyToItemId.set(ck.toLowerCase(), node.itemID);
      const bbt = (
        item as Zotero.Item & { getField: (f: string) => unknown }
      ).getField("citationKey");
      if (typeof bbt === "string" && bbt.trim()) {
        citekeyToItemId.set(bbt.trim().toLowerCase(), node.itemID);
      }
    } catch {
      /* soft */
    }
  }
  return { citekeyToItemId, itemKeyToItemId };
}

async function buildIdMapsFromLibraryAsync(
  libraryID: number,
): Promise<MarkdbIdMaps> {
  const raw = Zotero.Items.getAll(libraryID) as
    | Zotero.Item[]
    | Promise<Zotero.Item[]>;
  const items = Array.isArray(raw) ? raw : await raw;
  const citekeyToItemId = new Map<string, number>();
  const itemKeyToItemId = new Map<string, number>();
  for (const item of items) {
    if (!item.isRegularItem()) continue;
    itemKeyToItemId.set(item.key.toUpperCase(), item.id);
    try {
      const extra = String(item.getField("extra") || "");
      const ck = extractCitationKeyFromExtra(extra);
      if (ck) citekeyToItemId.set(ck.toLowerCase(), item.id);
      const bbt = (
        item as Zotero.Item & { getField: (f: string) => unknown }
      ).getField("citationKey");
      if (typeof bbt === "string" && bbt.trim()) {
        citekeyToItemId.set(bbt.trim().toLowerCase(), item.id);
      }
    } catch {
      /* soft */
    }
  }
  return { citekeyToItemId, itemKeyToItemId };
}

function resolveNoteItemId(
  note: MarkdbParsedNote,
  maps: MarkdbIdMaps,
): number | undefined {
  if (note.primaryItemKey) {
    const id = maps.itemKeyToItemId.get(note.primaryItemKey.toUpperCase());
    if (id) return id;
  }
  if (note.primaryCitekey) {
    return maps.citekeyToItemId.get(note.primaryCitekey.toLowerCase());
  }
  return undefined;
}

function rememberNotePaths(
  notes: MarkdbParsedNote[],
  maps: MarkdbIdMaps,
): Map<number, string[]> {
  const byId = new Map<number, string[]>();
  for (const note of notes) {
    const id = resolveNoteItemId(note, maps);
    if (!id || !note.path) continue;
    const list = byId.get(id) || [];
    list.push(note.path);
    byId.set(id, list);
  }
  lastNotePathsByItemId = byId;
  return byId;
}

async function syncMarkdbTagsFromVault(
  notes: MarkdbParsedNote[],
  maps: MarkdbIdMaps,
): Promise<{ tagged: number; removed: number }> {
  const tagstr = getMarkdbTag();
  const withNotes = new Set<number>();
  for (const note of notes) {
    const id = resolveNoteItemId(note, maps);
    if (id) withNotes.add(id);
  }

  const search = new Zotero.Search();
  search.addCondition("tag", "is", tagstr);
  const taggedIds = await search.search();
  const taggedSet = new Set(taggedIds);

  let tagged = 0;
  let removed = 0;

  for (const id of withNotes) {
    if (taggedSet.has(id)) continue;
    const item = Zotero.Items.get(id);
    if (!item?.isRegularItem()) continue;
    item.addTag(tagstr);
    await item.saveTx();
    tagged++;
  }

  for (const id of taggedIds) {
    if (withNotes.has(id)) continue;
    const item = Zotero.Items.get(id);
    if (!item?.isRegularItem()) continue;
    item.removeTag(tagstr);
    await item.saveTx();
    removed++;
  }

  return { tagged, removed };
}

function vaultNameFromPath(vaultPath: string): string {
  const parts = vaultPath.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || "vault";
}

function relativeVaultPath(vaultPath: string, notePath: string): string {
  const v = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const n = notePath.replace(/\\/g, "/");
  if (n.toLowerCase().startsWith(v.toLowerCase() + "/")) {
    return n.slice(v.length + 1);
  }
  return n.split("/").pop() || n;
}

function openObsidianNote(vaultPath: string, notePath: string): void {
  const vault = encodeURIComponent(vaultNameFromPath(vaultPath));
  const file = encodeURIComponent(relativeVaultPath(vaultPath, notePath));
  const uri = `obsidian://open?vault=${vault}&file=${file}`;
  try {
    Zotero.launchURL(uri);
  } catch (err) {
    ztoolkit.log("MarkDB Obsidian URI failed", uri, err);
    alertDialog(getString("markdb-error-open"));
  }
}

async function openMarkdbNoteForSelection(): Promise<void> {
  ensureMarkdbPrefDefaults();
  if (!isMarkdbEnabled()) {
    alertDialog(getString("markdb-disabled"));
    return;
  }
  const vaultPath = getMarkdbVaultPath();
  if (!vaultPath) {
    alertDialog(getString("markdb-error-no-path"));
    return;
  }

  const selected =
    getZoteroAdapter()
      .getActivePane()
      ?.getSelectedItems()
      ?.filter((i) => i.isRegularItem()) ?? [];
  if (!selected.length) {
    alertDialog(getString("markdb-error-no-selection"));
    return;
  }

  let paths = lastNotePathsByItemId.get(selected[0].id);
  if (!paths?.length) {
    try {
      const notes = await scanVaultMarkdownNotes(
        vaultPath,
        getMarkdbMatchStrategy(),
      );
      const maps = await buildIdMapsFromLibraryAsync(selected[0].libraryID);
      rememberNotePaths(notes, maps);
      paths = lastNotePathsByItemId.get(selected[0].id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alertDialog(getString("markdb-error-scan", { args: { message: msg } }));
      return;
    }
  }

  if (!paths?.length) {
    alertDialog(getString("markdb-error-no-note"));
    return;
  }
  openObsidianNote(vaultPath, paths[0]);
}

async function computeMarkdbNoteEdges(
  nodes: Map<number, GraphNode>,
): Promise<GraphEdge[]> {
  ensureMarkdbPrefDefaults();
  if (!isMarkdbEnabled()) return [];
  const vaultPath = getMarkdbVaultPath();
  if (!vaultPath) return [];

  let notes: MarkdbParsedNote[];
  try {
    notes = await scanVaultMarkdownNotes(vaultPath, getMarkdbMatchStrategy());
  } catch (err) {
    ztoolkit.log("MarkDB vault scan failed", err);
    return [];
  }

  const maps = buildIdMapsFromNodes(nodes);
  rememberNotePaths(notes, maps);
  const candidates = buildMarkdbEdgeCandidates(notes, maps);
  const edges: GraphEdge[] = [];

  for (const c of candidates) {
    const sourceNode = nodes.get(c.sourceItemId);
    const targetNode = nodes.get(c.targetItemId);
    if (!sourceNode || !targetNode) continue;
    const via = `mdbc:${c.viaPath}`;
    edges.push({
      id: makeEdgeId("note", c.sourceItemId, c.targetItemId, via),
      source: c.sourceItemId,
      target: c.targetItemId,
      layer: "note",
      state: "suggested",
      confidence: c.confidence,
      viaNoteSource: "markdb-vault",
      crossDiscipline: isCrossDiscipline(sourceNode, targetNode),
    });
  }
  return edges;
}

async function runManualVaultScan(): Promise<void> {
  ensureMarkdbPrefDefaults();
  if (!isMarkdbEnabled()) {
    alertDialog(getString("markdb-disabled"));
    return;
  }
  const vaultPath = getMarkdbVaultPath();
  if (!vaultPath) {
    alertDialog(getString("markdb-error-no-path"));
    return;
  }

  try {
    const notes = await scanVaultMarkdownNotes(
      vaultPath,
      getMarkdbMatchStrategy(),
    );
    const pane = getZoteroAdapter().getActivePane();
    const libraryID =
      pane?.getSelectedItems()?.[0]?.libraryID ??
      Zotero.Libraries.userLibraryID;
    const maps = await buildIdMapsFromLibraryAsync(libraryID);
    rememberNotePaths(notes, maps);
    const { tagged, removed } = await syncMarkdbTagsFromVault(notes, maps);
    const withPrimary = notes.filter(
      (n) => n.primaryCitekey || n.primaryItemKey,
    ).length;
    const msg = getString("markdb-scan-done", {
      args: {
        total: notes.length,
        matched: withPrimary,
        tagged,
        removed,
      },
    });
    updateHint(msg);
    alertDialog(msg);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    alertDialog(getString("markdb-error-scan", { args: { message: msg } }));
  }
}

function markdbMenuChild() {
  return {
    tag: "menu" as const,
    label: getString("menu-markdb"),
    children: [
      {
        tag: "menuitem" as const,
        label: getString("menu-markdb-scan"),
        commandListener: () => {
          void runManualVaultScan();
        },
      },
      {
        tag: "menuitem" as const,
        label: getString("menu-markdb-open"),
        commandListener: () => {
          void openMarkdbNoteForSelection();
        },
      },
    ],
  };
}
