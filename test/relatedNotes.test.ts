// @ajan: cursor · @etiket: f8.2.2, better-notes, vitest
import { describe, expect, it } from "vitest";
import { buildNoteLink } from "../src/vendor/zotero-better-notes/link";
import {
  extractOutboundNoteKeysFromHtml,
  mergeRelatedNoteCandidates,
} from "../src/vendor/zotero-better-notes/relatedNotes";

describe("relatedNotes", () => {
  it("extracts outbound note keys from HTML", () => {
    const hrefA = buildNoteLink("u", "AAAA1111");
    const hrefB = buildNoteLink("42", "BBBB2222");
    const html = `<p><a href="${hrefA}">A</a></p><p><a href="${hrefB}">B</a></p>`;
    expect(extractOutboundNoteKeysFromHtml(html).sort()).toEqual([
      "AAAA1111",
      "BBBB2222",
    ]);
  });

  it("merges siblings and outbound without duplicating source", () => {
    const merged = mergeRelatedNoteCandidates(
      "SRC00001",
      ["SRC00001", "SIB00001", "SIB00002"],
      ["SIB00001", "OUT00001"],
    );
    expect(merged).toEqual([
      { noteKey: "SIB00001", kind: "sibling" },
      { noteKey: "SIB00002", kind: "sibling" },
      { noteKey: "OUT00001", kind: "outbound" },
    ]);
  });
});
