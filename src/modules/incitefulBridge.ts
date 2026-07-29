// @ajan: cursor · @etiket: inciteful, citation-graph, menu

import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import {
  getIDsFromItems,
  openIncitefulConnector,
  openIncitefulSearch,
} from "../vendor/inciteful/incitefulCore";

export { initIncitefulMenus, isIncitefulEnabled };

function isIncitefulEnabled(): boolean {
  const v = getPref("inciteful.enabled");
  return v === undefined || v === true;
}

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

function onSearchItems() {
  if (!isIncitefulEnabled()) return;
  const selectedItems = getZoteroAdapter().getActivePane()?.getSelectedItems() ?? [];
  const ids = getIDsFromItems(selectedItems);
  openIncitefulSearch(ids);
}

function onConnectItems() {
  if (!isIncitefulEnabled()) return;
  const selectedItems = getZoteroAdapter().getActivePane()?.getSelectedItems() ?? [];
  if (selectedItems.length > 2) {
    alertDialog(getString("inciteful-error-too-many"));
    return;
  }
  const ids = getIDsFromItems(selectedItems);
  if (ids.length === 0) {
    alertDialog(getString("inciteful-error-no-item"));
    return;
  }
  openIncitefulConnector(ids[0], ids.length > 1 ? ids[1] : null);
}

function onSearchCollection() {
  if (!isIncitefulEnabled()) return;
  const collection = getZoteroAdapter().getActivePane()?.getSelectedCollection();
  if (!collection) return;
  const ids = getIDsFromItems(collection.getChildItems());
  openIncitefulSearch(ids);
}

function incitefulMenuChildren() {
  return [
    {
      tag: "menuitem" as const,
      label: getString("inciteful-menu-search"),
      commandListener: () => onSearchItems(),
    },
    {
      tag: "menuitem" as const,
      label: getString("inciteful-menu-connector"),
      commandListener: () => onConnectItems(),
    },
  ];
}

function initIncitefulMenus() {
  if (!isIncitefulEnabled()) return;

  const icon = `chrome://${config.addonRef}/content/icons/favicon.png`;

  ztoolkit.Menu.register("item", {
    tag: "menu",
    id: `${config.addonRef}-inciteful-item-menu`,
    label: getString("inciteful-menu-root"),
    icon,
    children: incitefulMenuChildren(),
  });

  ztoolkit.Menu.register("collection", {
    tag: "menuitem",
    id: `${config.addonRef}-inciteful-collection-search`,
    label: getString("inciteful-menu-collection-search"),
    icon,
    commandListener: () => onSearchCollection(),
  });
}
