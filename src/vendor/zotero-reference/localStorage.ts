// @ajan: cursor · @etiket: katman-3, zotero-reference, ioutils, os-file-removed
// Adapted from zotero-reference (AGPL-3.0) src/modules/localStorage.ts
// Zotero 9: window.OS / OS.File removed — use IOUtils + PathUtils.

class LocalStorage {
  public filename!: string;
  public cache: any;
  public lock: any;
  constructor(filename: string) {
    this.lock = Zotero.Promise.defer();
    void this.init(filename);
  }

  async init(filename: string) {
    if (!(await IOUtils.exists(filename))) {
      const temp = Zotero.getTempDirectory();
      const parentDir =
        typeof PathUtils !== "undefined" && PathUtils.parent
          ? PathUtils.parent(temp.path)
          : temp.path.replace(temp.leafName, "");
      this.filename = PathUtils.join(parentDir || temp.path, `${filename}.json`);
    } else {
      this.filename = filename;
    }
    try {
      const rawString = (await Zotero.File.getContentsAsync(
        this.filename,
      )) as string;
      this.cache = JSON.parse(rawString);
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
