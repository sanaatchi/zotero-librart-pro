// @ajan: cursor · @etiket: katman-3, tests, os-file-removed, ioutils
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("zotero-reference localStorage Zotero 9 IOUtils migration", () => {
  it("does not use window.OS / OS.File (removed in Zotero 9)", () => {
    const src = readFileSync(
      join(root, "src/vendor/zotero-reference/localStorage.ts"),
      "utf8",
    );
    // Strip line comments so doc notes about the removed API do not fail.
    const code = src
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");
    expect(code).not.toMatch(/window\.OS/);
    expect(code).not.toMatch(/OS\.File/);
    expect(code).not.toMatch(/OS\.Path/);
    expect(code).toMatch(/IOUtils\.exists/);
    expect(code).toMatch(/PathUtils\.join/);
  });
});
