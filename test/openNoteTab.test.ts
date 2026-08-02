// @ajan: cursor · @etiket: bn-workspace, test
import { describe, expect, it, vi } from "vitest";
import { openNotesInWorkspaceTabs } from "../src/vendor/zotero-better-notes/workspace/openNoteTab";

function fakeNote(id: number, isNote = true): Zotero.Item {
  return {
    id,
    isNote: () => isNote,
  } as unknown as Zotero.Item;
}

describe("openNotesInWorkspaceTabs", () => {
  it("opens up to max note items", async () => {
    const selectItem = vi.fn();
    const openNoteWindow = vi.fn();
    const n = await openNotesInWorkspaceTabs(
      [fakeNote(1), fakeNote(2), fakeNote(3, false), fakeNote(4)],
      { selectItem, openNoteWindow, max: 2 },
    );
    expect(n).toBe(2);
    expect(selectItem).toHaveBeenCalledTimes(2);
    expect(openNoteWindow).toHaveBeenCalledTimes(2);
  });
});
