// @ajan: cursor · @etiket: f8, markdb, vitest
import { describe, expect, it } from "vitest";
import {
  buildMarkdbEdgeCandidates,
  extractCitationKeyFromExtra,
  resolvePrimaryItemId,
} from "../src/vendor/markdb/markdbMatch";
import {
  extractBodyCitekeys,
  extractCitekeyFromFilename,
  extractCitekeyFromYaml,
  extractItemKeyFromFrontmatter,
  isMarkdownNoteFilename,
  parseMarkdownNote,
} from "../src/vendor/markdb/markdbScan";

describe("markdbScan", () => {
  it("filters @*.md filenames and extracts citekey", () => {
    expect(isMarkdownNoteFilename("@smith2020.md")).toBe(true);
    expect(isMarkdownNoteFilename("readme.md")).toBe(false);
    expect(extractCitekeyFromFilename("@smith2020 Title.md")).toBe("smith2020");
  });

  it("reads citekey from YAML frontmatter", () => {
    const md = `---
title: Hello
citekey: doe2021
tags: [a]
---
Body [[@smith2020]] and @jones2019.
`;
    expect(extractCitekeyFromYaml(md)).toBe("doe2021");
    expect(extractBodyCitekeys(md, "doe2021")).toEqual(
      expect.arrayContaining(["smith2020", "jones2019"]),
    );
  });

  it("parses zotitemkey frontmatter", () => {
    const md = `---
itemKey: ABCD1234
---
See also EFGH5678 in text.
`;
    expect(extractItemKeyFromFrontmatter(md)).toBe("ABCD1234");
    const note = parseMarkdownNote(
      "@unused.md",
      "/vault/@unused.md",
      md,
      "zotitemkey",
    );
    expect(note.primaryItemKey).toBe("ABCD1234");
    expect(note.refItemKeys).toContain("EFGH5678");
  });

  it("prefers YAML citekey over filename", () => {
    const note = parseMarkdownNote(
      "@fileKey.md",
      "/v/@fileKey.md",
      "---\ncitekey: yamlKey\n---\n",
      "citekeyyaml",
    );
    expect(note.primaryCitekey).toBe("yamlKey");
  });
});

describe("markdbMatch", () => {
  it("extracts Citation Key from Extra", () => {
    expect(
      extractCitationKeyFromExtra("Citation Key: abc2020\nDOI: 10.1"),
    ).toBe("abc2020");
    expect(extractCitationKeyFromExtra("citekey: xyz")).toBe("xyz");
  });

  it("builds undirected edge candidates", () => {
    const maps = {
      citekeyToItemId: new Map([
        ["a2020", 1],
        ["b2021", 2],
        ["c2022", 3],
      ]),
      itemKeyToItemId: new Map(),
    };
    const notes = [
      parseMarkdownNote(
        "@a2020.md",
        "/v/@a2020.md",
        "---\ncitekey: a2020\n---\nSee [[@b2021]] and @c2022.",
        "citekeyyaml",
      ),
    ];
    expect(resolvePrimaryItemId(notes[0], maps)).toBe(1);
    const edges = buildMarkdbEdgeCandidates(notes, maps);
    expect(edges).toHaveLength(2);
    expect(
      edges.map((e) => `${e.sourceItemId}-${e.targetItemId}`).sort(),
    ).toEqual(["1-2", "1-3"]);
  });

  it("returns empty when primary unresolved", () => {
    const maps = {
      citekeyToItemId: new Map([["other", 9]]),
      itemKeyToItemId: new Map(),
    };
    const notes = [
      parseMarkdownNote("@missing.md", "/v/@missing.md", "body", "citekeyyaml"),
    ];
    expect(buildMarkdbEdgeCandidates(notes, maps)).toEqual([]);
  });
});
