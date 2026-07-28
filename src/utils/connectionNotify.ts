import {
  computeNoteLayerEdgesFromNotes,
  promoteHighConfidenceNoteEdges,
} from "./connectionNoteLayer";
import { buildGraphNode } from "./connectionGraph";
import { isWindowAlive } from "./window";

export {
  registerConnectionMapNoteObserver,
  unregisterConnectionMapNoteObserver,
};

/**
 * Window-lifecycle-bound note observer for layer D.
 *
 * Intentionally separate from modules/notify.ts's process-lifetime observer —
 * this must only be active while the Connection Map window is open.
 * Do not "simplify" by folding into the global notifier: that would keep
 * promoting relations after the map is closed and risk listener leaks across
 * repeated open/close cycles.
 */

let notifierID: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let boundLibraryID: number | null = null;
let boundWindow: Window | null = null;
let onAfterPromote: (() => void) | null = null;
let pendingNoteIDs = new Set<number>();

const DEBOUNCE_MS = 800;

function registerConnectionMapNoteObserver(
  win: Window,
  libraryID: number,
  refreshCallback?: () => void,
): void {
  // Ensure at most one registration (re-open / refresh safe).
  unregisterConnectionMapNoteObserver();

  boundLibraryID = libraryID;
  boundWindow = win;
  onAfterPromote = refreshCallback || null;
  pendingNoteIDs = new Set();

  const callback = {
    notify: (
      event: string,
      type: string,
      ids: number[] | string[],
      _extraData: { [key: string]: any },
    ) => {
      if (!addon?.data.alive) {
        unregisterConnectionMapNoteObserver();
        return;
      }
      // Drop events if the map window is already gone.
      if (!isWindowAlive(boundWindow || undefined)) {
        unregisterConnectionMapNoteObserver();
        return;
      }
      if (type !== "item") return;
      if (event !== "modify" && event !== "add") return;

      const numericIDs = (ids as Array<string | number>)
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!numericIDs.length) return;

      const items = Zotero.Items.get(numericIDs);
      const noteIDs = items
        .filter((i) => i?.isNote())
        .map((i) => i.id);
      if (!noteIDs.length) return;

      for (const id of noteIDs) pendingNoteIDs.add(id);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const batch = [...pendingNoteIDs];
        pendingNoteIDs.clear();
        void handleNoteChange(batch);
      }, DEBOUNCE_MS);
    },
  };

  notifierID = Zotero.Notifier.registerObserver(
    callback,
    ["item"],
    "connectionMapNoteWatch",
  );
}

function unregisterConnectionMapNoteObserver(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingNoteIDs.clear();
  if (notifierID) {
    try {
      Zotero.Notifier.unregisterObserver(notifierID);
    } catch {
      // already unregistered
    }
    notifierID = null;
  }
  boundLibraryID = null;
  boundWindow = null;
  onAfterPromote = null;
}

async function handleNoteChange(noteIDs: number[]): Promise<void> {
  if (!isWindowAlive(boundWindow || undefined)) {
    unregisterConnectionMapNoteObserver();
    return;
  }
  const libraryID = boundLibraryID ?? Zotero.Libraries.userLibraryID;
  try {
    const notes = Zotero.Items.get(noteIDs).filter(
      (i) => i?.isNote() && !i.deleted,
    );
    if (!notes.length) return;

    // Node map: citing parents + citation targets we can resolve cheaply.
    // Full library node map only for promotion crossDiscipline / membership.
    const allItems = await Zotero.Items.getAll(libraryID);
    const regular = allItems.filter((i) => i.isRegularItem() && !i.deleted);
    const nodes = new Map(
      regular.map((item) => [item.id, buildGraphNode(item)] as const),
    );

    const edges = computeNoteLayerEdgesFromNotes(notes, nodes);
    const promoted = await promoteHighConfidenceNoteEdges(edges);
    if (promoted > 0) {
      ztoolkit.log(`Connection Map: auto-promoted ${promoted} note edge(s)`);
      if (isWindowAlive(boundWindow || undefined)) {
        onAfterPromote?.();
      }
    }
  } catch (e) {
    ztoolkit.log("Connection Map note observer failed", e);
  }
}
