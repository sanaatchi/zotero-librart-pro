// @ajan: cursor · @etiket: bn-workspace, better-notes, vendor, makale-yazim
// Selective AGPL helpers inspired by zotero-better-notes workspace/tab (open notes).

/**
 * Open note items in the Zotero pane (select + note window when available).
 * Full BN workspace chrome remains deferred.
 */
export async function openNotesInWorkspaceTabs(
  notes: Zotero.Item[],
  opts: {
    selectItem?: (id: number) => void;
    openNoteWindow?: (id: number) => void;
    max?: number;
  } = {},
): Promise<number> {
  const max = opts.max ?? 8;
  let opened = 0;
  for (const note of notes) {
    if (opened >= max) break;
    if (!note?.isNote?.()) continue;
    try {
      opts.selectItem?.(note.id);
    } catch {
      /* soft */
    }
    try {
      opts.openNoteWindow?.(note.id);
    } catch {
      /* soft */
    }
    opened++;
  }
  return opened;
}
