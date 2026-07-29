import { ActionShowInMenu } from "./actions";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";

export { getCurrentItems, getItemIDsByKey };

async function getCurrentItems(
  type?: ActionShowInMenu,
  extraData?: {
    readerID?: string;
  },
): Promise<Zotero.Item[]>;

async function getCurrentItems(
  type?: ActionShowInMenu,
  extraData?: {
    readerID?: string;
    asIDs: true;
  },
): Promise<number[]>;

async function getCurrentItems(
  type?: ActionShowInMenu,
  extraData?: {
    readerID?: string;
    asIDs?: boolean;
  },
): Promise<Zotero.Item[] | number[]> {
  const adapter = getZoteroAdapter();
  const asIDs = !!extraData?.asIDs;
  let items = [] as Zotero.Item[] | number[];
  if (!type || type === "tools") {
    type = getCurrentTargetType(adapter);
  }
  switch (type) {
    case "item": {
      const pane = adapter.getActivePane();
      if (!pane) break;
      items = asIDs
        ? pane.getSelectedItems(true)
        : pane.getSelectedItems(false);
      break;
    }
    case "collection": {
      const pane = adapter.getActivePane();
      if (!pane) break;
      const collection = pane.getSelectedCollection();
      if (collection) {
        items = asIDs
          ? collection.getChildItems(true)
          : collection.getChildItems(false);
      } else {
        const libraryID = pane.getSelectedLibraryID();
        if (libraryID) {
          items = await adapter.getAllItems(libraryID, asIDs);
        }
      }
      break;
    }
    case "reader": {
      let reader: _ZoteroTypes.ReaderInstance | undefined;
      if (extraData?.readerID) {
        reader = adapter.findReaderByInstanceId(extraData.readerID);
        if (!reader) {
          throw new Error(
            `Reader ${extraData.readerID} not found in getCurrentItems()`,
          );
        }
      } else {
        const tabId = adapter.getSelectedTabId();
        reader = tabId ? adapter.getReaderByTabId(tabId) : undefined;
      }
      if (!reader) break;
      const annotationIDs =
        // @ts-ignore TODO: update types
        reader?._internalReader._lastView._selectedAnnotationIDs as string[];
      if (annotationIDs?.length) {
        for (const key of annotationIDs) {
          const item = adapter.getItemByLibraryAndKey(
            reader._item.libraryID,
            key,
          ) as Zotero.Item;
          if (!item) continue;
          items.push((asIDs ? item.id : item) as Zotero.Item & number);
        }
      } else {
        items = [asIDs ? reader._item.id : reader._item] as Zotero.Item[] &
          number[];
      }
      break;
    }
  }
  return items;
}

function getItemIDsByKey(libraryID: number, ...keys: string[]) {
  const adapter = getZoteroAdapter();
  const itemIDs = [] as number[];
  for (const key of keys) {
    const item = adapter.getItemByLibraryAndKey(libraryID, key);
    if (item) {
      itemIDs.push(item.id);
    }
  }
  return itemIDs;
}

function getCurrentTargetType(adapter = getZoteroAdapter()) {
  switch (adapter.getSelectedTabType()) {
    case "library": {
      return "item";
    }
    case "reader": {
      return "reader";
    }
    default:
      return "item";
  }
}
