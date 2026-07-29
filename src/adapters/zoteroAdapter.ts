// @ajan: cursor · @etiket: f1, adapter, zotero
/**
 * Thin facade over Zotero globals. New LibRart code should use this instead of
 * calling `Zotero.*` / `Zotero_Tabs` directly (vendor ports exempt).
 */
export type ZoteroAdapter = {
  waitForReady(): Promise<void>;
  getActivePane(): _ZoteroTypes.ZoteroPane | undefined;
  getSelectedTabType(): string | undefined;
  getSelectedTabId(): string | undefined;
  getItemByLibraryAndKey(
    libraryID: number,
    key: string,
  ): Zotero.Item | false;
  getAllItems(
    libraryID: number,
    asIds: boolean,
  ): Promise<Zotero.Item[] | number[]>;
  findReaderByInstanceId(instanceId: string): _ZoteroTypes.ReaderInstance | undefined;
  getReaderByTabId(tabId: string): _ZoteroTypes.ReaderInstance | undefined;
};

export { createZoteroAdapter, getZoteroAdapter, setZoteroAdapter };

let adapterInstance: ZoteroAdapter | null = null;

function getZoteroAdapter(): ZoteroAdapter {
  if (!adapterInstance) {
    adapterInstance = createZoteroAdapter();
  }
  return adapterInstance;
}

/** Test hook — reset to default production adapter when passed `null`. */
function setZoteroAdapter(next: ZoteroAdapter | null): void {
  adapterInstance = next;
}

function createZoteroAdapter(): ZoteroAdapter {
  return {
    async waitForReady() {
      await Promise.all([
        Zotero.initializationPromise,
        Zotero.unlockPromise,
        Zotero.uiReadyPromise,
      ]);
    },
    getActivePane() {
      return Zotero.getActiveZoteroPane();
    },
    getSelectedTabType() {
      return Zotero_Tabs.selectedType;
    },
    getSelectedTabId() {
      return Zotero_Tabs.selectedID;
    },
    getItemByLibraryAndKey(libraryID, key) {
      return Zotero.Items.getByLibraryAndKey(libraryID, key);
    },
    async getAllItems(libraryID, asIds) {
      if (asIds) {
        return Zotero.Items.getAll(libraryID, false, false, true);
      }
      return Zotero.Items.getAll(libraryID, false, false, false);
    },
    findReaderByInstanceId(instanceId) {
      return Zotero.Reader._readers.find((r) => r._instanceID === instanceId);
    },
    getReaderByTabId(tabId) {
      return Zotero.Reader.getByTabID(tabId);
    },
  };
}
