// @ajan: cursor · @etiket: katman-3, tests, os-file-removed, ioutils, ioutils-path-fix
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocalStorage, {
  resolveLocalStorageFilename,
} from "../src/vendor/zotero-reference/localStorage";

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

/**
 * `views.ts` calls `new LocalStorage(\`${config.addonRef}-reference-cache\`)`
 * — a bare name (e.g. `librartpro-reference-cache`), not a path. Real Zotero
 * 9 `IOUtils.*` throws `NS_ERROR_FILE_UNRECOGNIZED_PATH` ("could not parse
 * path") for any non-absolute path. This stub reproduces that behavior so the
 * tests below fail against the pre-fix code, which called
 * `IOUtils.exists(filename)` with the bare name before resolving it.
 */
function stubZoteroIOUtils(dataDir: string) {
  vi.stubGlobal("PathUtils", {
    join: (...parts: string[]) => parts.join("/"),
  });
  vi.stubGlobal("IOUtils", {
    exists: async (path: string) => {
      if (!/^[a-zA-Z]:[\\/]/.test(path) && !/^[\\/]/.test(path)) {
        throw new Error(
          `Could not determine if \`${path}' exists: could not parse path (NS_ERROR_FILE_UNRECOGNIZED_PATH)`,
        );
      }
      return false;
    },
  });
  vi.stubGlobal("Zotero", {
    Promise: {
      defer: () => {
        let resolve!: () => void;
        const promise = new Promise<void>((r) => {
          resolve = r;
        });
        return { promise, resolve: () => resolve() };
      },
    },
    DataDirectory: { dir: dataDir },
    File: {
      getContentsAsync: async () => "{}",
      putContentsAsync: async () => undefined,
    },
    getMainWindow: () => undefined,
  });
}

describe("resolveLocalStorageFilename", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves a bare cache identifier to an absolute path under the Zotero data directory", () => {
    stubZoteroIOUtils("C:\\Users\\test\\Zotero");
    const resolved = resolveLocalStorageFilename("librartpro-reference-cache");
    expect(resolved).not.toBe("librartpro-reference-cache");
    expect(resolved).toBe(
      "C:\\Users\\test\\Zotero/librartpro-reference-cache.json",
    );
  });

  it("leaves an already-absolute path untouched", () => {
    stubZoteroIOUtils("C:\\Users\\test\\Zotero");
    expect(resolveLocalStorageFilename("C:\\profile\\cache.json")).toBe(
      "C:\\profile\\cache.json",
    );
    expect(resolveLocalStorageFilename("/home/user/cache.json")).toBe(
      "/home/user/cache.json",
    );
  });
});

describe("LocalStorage init with a bare cache name (regression)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not throw NS_ERROR_FILE_UNRECOGNIZED_PATH when constructed with a bare cache name", async () => {
    stubZoteroIOUtils("C:\\Users\\test\\Zotero");
    const store = new LocalStorage("librartpro-reference-cache");
    await store.lock.promise;
    expect(store.cache).toEqual({});
    expect(store.filename).toBe(
      "C:\\Users\\test\\Zotero/librartpro-reference-cache.json",
    );
  });
});
