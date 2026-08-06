// @ajan: cursor · @etiket: katman-3, zotero-reference, ioutils, ioutils-path-fix
// Adapted from zotero-reference (AGPL-3.0) src/modules/localStorage.ts
// Zotero 9: window.OS / OS.File removed — use IOUtils + PathUtils.

/**
 * `views.ts` constructs this with a bare cache identifier (e.g.
 * `librartpro-reference-cache`), not a path. `IOUtils.*` (Zotero 9) requires
 * an absolute path and throws `NS_ERROR_FILE_UNRECOGNIZED_PATH` — "could not
 * parse path" — for anything else, so calling `IOUtils.exists()` directly on
 * that bare name always throws before the old fallback-resolution code could
 * even run. Resolve to an absolute path under the Zotero data directory
 * *before* touching IOUtils, mirroring the convention used elsewhere in this
 * addon (see `src/utils/openAlexCitationLayer.ts`). Callers that already pass
 * an absolute path (Windows drive letter or POSIX root) are left untouched.
 */
export function resolveLocalStorageFilename(filename: string): string {
  if (/^[a-zA-Z]:[\\/]/.test(filename) || /^[\\/]/.test(filename)) {
    return filename;
  }
  const name = filename.endsWith(".json") ? filename : `${filename}.json`;
  return PathUtils.join(Zotero.DataDirectory.dir, name);
}

class LocalStorage {
  public filename!: string;
  public cache: any;
  public lock: any;
  constructor(filename: string) {
    this.lock = Zotero.Promise.defer();
    void this.init(filename);
  }

  async init(filename: string) {
    this.filename = resolveLocalStorageFilename(filename);
    try {
      if (await IOUtils.exists(this.filename)) {
        const rawString = (await Zotero.File.getContentsAsync(
          this.filename,
        )) as string;
        this.cache = JSON.parse(rawString);
      } else {
        this.cache = {};
      }
    } catch {
      this.cache = {};
    }
    this.lock.resolve();
  }

  get(item: Zotero.Item | { key: string }, key: string) {
    if (this.cache == undefined) {
      return;
    }
    return (this.cache[item.key] ??= {})[key];
  }

  async set(item: Zotero.Item | { key: string }, key: string, value: any) {
    await this.lock.promise;
    (this.cache[item.key] ??= {})[key] = value;
    const win = Zotero.getMainWindow?.() ?? window;
    win.setTimeout(async () => {
      await Zotero.File.putContentsAsync(
        this.filename,
        JSON.stringify(this.cache),
      );
    });
  }
}

export default LocalStorage;
