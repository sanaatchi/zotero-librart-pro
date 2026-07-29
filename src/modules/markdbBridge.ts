// @ajan: cursor · @etiket: f8, markdb, bridge, menu
// Obsidian/MarkDB vault → Bağlantı Haritası note edges.
// Scan patterns adapted from zotero-markdb-connect (MIT).

import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { updateHint } from "../utils/hint";
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
};

const MAX_VAULT_FILES = 2500;

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
      // Better BibTeX may expose citationKey on some builds.
      const bbt = (item as Zotero.Item & { getField: (f: string) => unknown }).getField(
        "citationKey",
      );
      if (typeof bbt === "string" && bbt.trim()) {
        citekeyToItemId.set(bbt.trim().toLowerCase(), node.itemID);
      }
    } catch {
      /* soft */
    }
  }
  return { citekeyToItemId, itemKeyToItemId };
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
    notes = await scanVaultMarkdownNotes(
      vaultPath,
      getMarkdbMatchStrategy(),
    );
  } catch (err) {
    ztoolkit.log("MarkDB vault scan failed", err);
    return [];
  }

  const maps = buildIdMapsFromNodes(nodes);
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
    const withPrimary = notes.filter(
      (n) => n.primaryCitekey || n.primaryItemKey,
    ).length;
    updateHint(
      getString("markdb-scan-done", {
        args: { total: notes.length, matched: withPrimary },
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    alertDialog(getString("markdb-error-scan", { args: { message: msg } }));
  }
}

function markdbMenuChild() {
  return {
    tag: "menuitem" as const,
    label: getString("menu-markdb-scan"),
    commandListener: () => {
      void runManualVaultScan();
    },
  };
}
