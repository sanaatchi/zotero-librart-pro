export { recordTabStatus };

// @ajan: claude · @etiket: tabs, reader-tab-teardown-guard
function recordTabStatus() {
  addon.data.tabStatus.clear();
  for (const tab of Zotero_Tabs._tabs) {
    if (tab.type === "reader" && tab.data) {
      addon.data.tabStatus.set(tab.id, tab.data.itemID);
    }
  }
}
