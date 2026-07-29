// @ajan: cursor · @etiket: f8.2, better-notes, vitest
import { describe, expect, it } from "vitest";
import {
  buildNoteLink,
  buildNoteLinkAnchorHtml,
  parseNoteLinkHref,
} from "../src/vendor/zotero-better-notes/link";
import { appendHtmlToNoteContent } from "../src/vendor/zotero-better-notes/noteHtml";

describe("better-notes link helpers", () => {
  it("builds user and group note links", () => {
    expect(buildNoteLink("u", "ABCD1234")).toBe("zotero://note/u/ABCD1234/");
    expect(buildNoteLink("42", "ABCD1234", { lineIndex: 3 })).toBe(
      "zotero://note/42/ABCD1234/?line=3",
    );
    expect(
      buildNoteLink("u", "ABCD1234", {
        sectionName: "Intro",
        selectionText: "hello world",
      }),
    ).toBe(
      "zotero://note/u/ABCD1234/?section=Intro#hello%20world",
    );
  });

  it("parses note link hrefs", () => {
    const parsed = parseNoteLinkHref(
      "zotero://note/u/ABCD1234/?line=2&ignore=1#sel",
    );
    expect(parsed).toMatchObject({
      libraryToken: "u",
      noteKey: "ABCD1234",
      lineIndex: 2,
      ignore: true,
      selectionText: "sel",
    });
    expect(parseNoteLinkHref("https://example.com")).toBeNull();
  });

  it("builds anchors extractBetterNotesWikilinks can match", () => {
    const href = buildNoteLink("u", "ZZZZ9999");
    const html = buildNoteLinkAnchorHtml(href, 'Title <x>');
    expect(html).toContain('href="zotero://note/u/ZZZZ9999/"');
    expect(html).toContain("Title &lt;x&gt;");
    expect(html).toMatch(/href="zotero:\/\/note\/(?:u|\d+)\/[A-Z0-9]+\//i);
  });
});

describe("noteHtml append", () => {
  it("wraps empty notes and appends before closing schema div", () => {
    expect(appendHtmlToNoteContent("", "<p>a</p>")).toBe(
      '<div data-schema-version="9"><p>a</p></div>',
    );
    const next = appendHtmlToNoteContent(
      '<div data-schema-version="9"><p>old</p></div>',
      "<p>new</p>",
    );
    expect(next).toBe(
      '<div data-schema-version="9"><p>old</p><p>new</p></div>',
    );
  });
});
