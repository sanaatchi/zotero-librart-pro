// @ajan: claude · @etiket: connection-map, scope, test, bugfix, group-library
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONNECTION_MAP_MAX_NODES,
  expandRelated,
} from "../src/utils/connectionMapScope";

describe("connectionMapScope constants", () => {
  it("keeps a usable display ceiling", () => {
    expect(CONNECTION_MAP_MAX_NODES).toBeGreaterThanOrEqual(40);
    expect(CONNECTION_MAP_MAX_NODES).toBeLessThanOrEqual(200);
  });
});

describe("expandRelated (multi-library correctness)", () => {
  afterEach(() => {
    (globalThis as Record<string, unknown>).Zotero = undefined;
  });

  function makeItem(
    id: number,
    libraryID: number,
    relatedItems: string[] = [],
  ): Zotero.Item {
    return {
      id,
      libraryID,
      relatedItems,
      isRegularItem: () => true,
      deleted: false,
    } as unknown as Zotero.Item;
  }

  it("looks up a related item's key in *that item's own* library, not the seed's", () => {
    // Regression test for a real bug: the old code looked up relatedKey in
    // a caller-supplied `libraryID` first and only fell back to
    // `item.libraryID` if that lookup was falsy. Zotero item keys are only
    // unique *within* a library, so a lookup against the wrong library
    // could silently return an unrelated item there instead of the correct
    // one, or (as tested here) simply fail to resolve at all when the
    // wrong-library lookup is queried instead of the right one.
    const groupLibraryID = 2; // not the personal library
    const relatedInGroup = makeItem(202, groupLibraryID);
    const seed = makeItem(201, groupLibraryID, ["ABCD1234"]);

    const getByLibraryAndKey = vi.fn(
      (libraryID: number, key: string): Zotero.Item | false => {
        if (libraryID === groupLibraryID && key === "ABCD1234") {
          return relatedInGroup;
        }
        return false;
      },
    );

    (globalThis as Record<string, unknown>).Zotero = {
      Items: { getByLibraryAndKey },
    };

    const result = expandRelated([seed]);

    expect(result).toEqual([201, 202]);
    // Only ever queried with the item's own (group) library — never with
    // some other/default library id.
    for (const call of getByLibraryAndKey.mock.calls) {
      expect(call[0]).toBe(groupLibraryID);
    }
  });
});
