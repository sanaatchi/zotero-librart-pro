// @ajan: cursor · @etiket: f8.2, f8.2.2, better-notes, workspace, bridge
// F8.2.1 — Insert BN-compatible note wikilinks (opt-in).
// F8.2.2 — Related notes list (siblings + outbound links) + jump.
// Full BN workspace chrome deferred.

import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { updateHint } from "../utils/hint";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import {
  buildNoteLink,
  buildNoteLinkAnchorHtml,
  NoteLinkOptions,
} from "../vendor/zotero-better-notes/link";
import { appendHtmlToNoteContent } from "../vendor/zotero-better-notes/noteHtml";
import {
  extractOutboundNoteKeysFromHtml,
  mergeRelatedNoteCandidates,
  RelatedNoteCandidate,
} from "../vendor/zotero-better-notes/relatedNotes";

export {
  initNoteWorkspace,
  isNoteWorkspaceEnabled,
  ensureNoteWorkspacePrefDefaults,
  noteWorkspaceMenuChild,
  insertNoteLinkIntoSelection,
  showRelatedNotesForSelection,
  getNoteLinkForItem,
  collectRelatedNotesForItem,
};

function ensureNoteWorkspacePrefDefaults(): void {
  if (getPref("note.workspace.enabled") === undefined) {
    const legacy = getPref("noteWorkspace");
    if (legacy === true || legacy === false) {
      setPref("note.workspace.enabled", false);
    } else {
      setPref("note.workspace.enabled", false);
    }
  }
}

function isNoteWorkspaceEnabled(): boolean {
  return getPref("note.workspace.enabled") === true;
}

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

function getNoteLinkForItem(
  noteItem: Zotero.Item,
  options: NoteLinkOptions = {},
): string | undefined {
  if (!noteItem?.isNote()) return undefined;
  const library = Zotero.Libraries.get(noteItem.libraryID);
  if (!library) return undefined;
  const token =
    library.libraryType === "user" ? "u" : String(noteItem.libraryID);
  if (library.libraryType !== "user" && library.libraryType !== "group") {
    return undefined;
  }
  return buildNoteLink(token, noteItem.key, options);
}

function noteDisplayTitle(note: Zotero.Item): string {
  try {
    const t = String(note.getNoteTitle?.() || note.getDisplayTitle?.() || "");
    if (t.trim()) return t.trim().slice(0, 120);
  } catch {
    /* soft */
  }
  return note.key;
}

async function pickNoteItemIds(): Promise<number[]> {
  const io = {
    singleSelection: true,
    dataIn: null as unknown,
    dataOut: null as unknown,
    deferred: Zotero.Promise.defer(),
  };
  const win = Zotero.getMainWindow();
  if (!win?.openDialog) return [];
  win.openDialog(
    "chrome://zotero/content/selectItemsDialog.xhtml",
    "",
    "chrome,dialog=no,centerscreen,resizable=yes",
    io,
  );
  await io.deferred.promise;
  const ids = io.dataOut as number[] | null;
  return Array.isArray(ids) ? ids : [];
}

function resolveSourceNote(selected: Zotero.Item[]): Zotero.Item | null {
  for (const item of selected) {
    if (item.isNote()) return item;
  }
  for (const item of selected) {
    if (!item.isRegularItem()) continue;
    try {
      const notes = item.getNotes?.(false) ?? [];
      for (const noteID of notes) {
        const note = Zotero.Items.get(noteID);
        if (note?.isNote()) return note;
      }
    } catch {
      /* soft */
    }
  }
  return null;
}

async function appendLinkToNote(
  sourceNote: Zotero.Item,
  targetNote: Zotero.Item,
): Promise<string | null> {
  const href = getNoteLinkForItem(targetNote);
  if (!href) return null;
  const title = noteDisplayTitle(targetNote);
  const anchor = buildNoteLinkAnchorHtml(href, title);
  const next = appendHtmlToNoteContent(
    String(sourceNote.getNote() || ""),
    anchor,
  );
  sourceNote.setNote(next);
  await sourceNote.saveTx();
  return href;
}

async function insertNoteLinkIntoSelection(): Promise<void> {
  ensureNoteWorkspacePrefDefaults();
  if (!isNoteWorkspaceEnabled()) {
    alertDialog(getString("note-workspace-disabled"));
    return;
  }

  const selected =
    getZoteroAdapter()
      .getActivePane()
      ?.getSelectedItems()
      ?.filter((i) => i.isRegularItem() || i.isNote()) ?? [];

  const sourceNote = resolveSourceNote(selected);
  if (!sourceNote) {
    alertDialog(getString("note-workspace-error-no-source"));
    return;
  }

  const pickedIds = await pickNoteItemIds();
  if (!pickedIds.length) return;

  let targetNote: Zotero.Item | null = null;
  for (const id of pickedIds) {
    const item = Zotero.Items.get(id);
    if (!item) continue;
    if (item.isNote()) {
      targetNote = item;
      break;
    }
    if (item.isRegularItem()) {
      const notes = item.getNotes?.(false) ?? [];
      if (notes.length) {
        const note = Zotero.Items.get(notes[0]);
        if (note?.isNote()) {
          targetNote = note;
          break;
        }
      }
    }
  }

  if (!targetNote) {
    alertDialog(getString("note-workspace-error-no-target"));
    return;
  }
  if (targetNote.id === sourceNote.id) {
    alertDialog(getString("note-workspace-error-same"));
    return;
  }

  try {
    const href = await appendLinkToNote(sourceNote, targetNote);
    if (!href) {
      alertDialog(getString("note-workspace-error-link"));
      return;
    }
    updateHint(getString("note-workspace-done"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    alertDialog(
      getString("note-workspace-error-insert", { args: { message: msg } }),
    );
  }
}

type RelatedNoteRow = {
  note: Zotero.Item;
  kind: RelatedNoteCandidate["kind"];
  label: string;
};

function collectRelatedNotesForItem(sourceNote: Zotero.Item): RelatedNoteRow[] {
  const siblingKeys: string[] = [];
  const parentID = sourceNote.parentItemID;
  if (parentID) {
    const parent = Zotero.Items.get(parentID);
    const noteIDs = parent?.getNotes?.(false) ?? [];
    for (const id of noteIDs) {
      const n = Zotero.Items.get(id);
      if (n?.isNote()) siblingKeys.push(n.key);
    }
  }

  const outboundKeys = extractOutboundNoteKeysFromHtml(
    String(sourceNote.getNote() || ""),
  );
  const candidates = mergeRelatedNoteCandidates(
    sourceNote.key,
    siblingKeys,
    outboundKeys,
  );

  const rows: RelatedNoteRow[] = [];
  for (const c of candidates) {
    let note: Zotero.Item | null = null;
    const direct = Zotero.Items.getByLibraryAndKey(
      sourceNote.libraryID,
      c.noteKey,
    );
    if (direct && typeof direct !== "boolean" && direct.isNote()) {
      note = direct;
    }
    if (!note) {
      for (const lib of Zotero.Libraries.getAll()) {
        const found = Zotero.Items.getByLibraryAndKey(
          lib.libraryID,
          c.noteKey,
        );
        if (found && typeof found !== "boolean" && found.isNote()) {
          note = found;
          break;
        }
      }
    }
    if (!note) continue;
    const kindLabel =
      c.kind === "sibling"
        ? getString("note-related-kind-sibling")
        : getString("note-related-kind-outbound");
    rows.push({
      note,
      kind: c.kind,
      label: `${kindLabel}: ${noteDisplayTitle(note)}`,
    });
  }
  return rows;
}

function selectRelatedNoteInteractive(rows: RelatedNoteRow[]): Zotero.Item | null {
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0].note;

  try {
    const Services = ztoolkit.getGlobal("Services") as {
      prompt: {
        select: (
          win: Window | null,
          title: string,
          message: string,
          list: string[],
          selected: { value: number },
        ) => boolean;
      };
    };
    const win = Zotero.getMainWindow() as Window | null;
    const selected = { value: 0 };
    const ok = Services.prompt.select(
      win,
      getString("note-related-title"),
      getString("note-related-prompt"),
      rows.map((r) => r.label),
      selected,
    );
    if (!ok || selected.value < 0 || selected.value >= rows.length) return null;
    return rows[selected.value].note;
  } catch {
    return rows[0].note;
  }
}

async function openOrSelectNote(note: Zotero.Item): Promise<void> {
  const pane = getZoteroAdapter().getActivePane() as
    | (ReturnType<ReturnType<typeof getZoteroAdapter>["getActivePane"]> & {
        selectItem?: (id: number) => void;
        openNoteWindow?: (id: number) => void;
      })
    | null
    | undefined;
  try {
    pane?.selectItem?.(note.id);
  } catch {
    /* soft */
  }
  try {
    pane?.openNoteWindow?.(note.id);
  } catch {
    /* soft */
  }
}

async function showRelatedNotesForSelection(): Promise<void> {
  ensureNoteWorkspacePrefDefaults();
  if (!isNoteWorkspaceEnabled()) {
    alertDialog(getString("note-workspace-disabled"));
    return;
  }

  const selected =
    getZoteroAdapter()
      .getActivePane()
      ?.getSelectedItems()
      ?.filter((i) => i.isRegularItem() || i.isNote()) ?? [];

  const sourceNote = resolveSourceNote(selected);
  if (!sourceNote) {
    alertDialog(getString("note-workspace-error-no-source"));
    return;
  }

  const rows = collectRelatedNotesForItem(sourceNote);
  if (!rows.length) {
    alertDialog(getString("note-related-empty"));
    return;
  }

  const target = selectRelatedNoteInteractive(rows);
  if (!target) return;
  await openOrSelectNote(target);
  updateHint(
    getString("note-related-opened", {
      args: { title: noteDisplayTitle(target) },
    }),
  );
}

function noteWorkspaceMenuChild() {
  return {
    tag: "menu" as const,
    label: getString("menu-note-workspace"),
    icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
    children: [
      {
        tag: "menuitem" as const,
        label: getString("menu-note-link-insert"),
        commandListener: () => {
          void insertNoteLinkIntoSelection();
        },
      },
      {
        tag: "menuitem" as const,
        label: getString("menu-note-related"),
        commandListener: () => {
          void showRelatedNotesForSelection();
        },
      },
    ],
  };
}

async function initNoteWorkspace(): Promise<void> {
  ensureNoteWorkspacePrefDefaults();
  if (!isNoteWorkspaceEnabled()) return;
  ztoolkit.log(
    "Note workspace (F8.2.2): note-link insert + related notes; full BN UI deferred.",
  );
}
