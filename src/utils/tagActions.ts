export { mergeTags, deleteTags };

/**
 * Find all items in a library carrying an exact tag name.
 * Uses Zotero.Search so it works the same way the tag selector does
 * (respects trash, all item types, whole library — not just one collection).
 */
async function getItemsWithTag(
  libraryID: number,
  tagName: string,
): Promise<Zotero.Item[]> {
  const search = new Zotero.Search({ libraryID });
  search.addCondition("tag", "is", tagName);
  const itemIDs = await search.search();
  return Zotero.Items.get(itemIDs);
}

async function saveItems(items: Zotero.Item[]) {
  if (!items.length) return;
  await Zotero.DB.executeTransaction(async () => {
    for (const item of items) {
      await item.save();
    }
  });
}

/**
 * Merge one or more source tags into a single target tag, library-wide.
 * Removes each source tag and adds the target tag on every item that had it.
 * Returns the number of distinct items touched.
 */
async function mergeTags(
  libraryID: number,
  oldNames: string[],
  newName: string,
): Promise<number> {
  newName = newName.trim();
  if (!newName) return 0;
  const touched = new Set<number>();
  for (const rawOldName of oldNames) {
    const oldName = rawOldName.trim();
    if (!oldName || oldName === newName) continue;
    const items = await getItemsWithTag(libraryID, oldName);
    for (const item of items) {
      if (!item.hasTag(newName)) {
        item.addTag(newName);
      }
      item.removeTag(oldName);
      touched.add(item.id);
    }
    await saveItems(items);
  }
  return touched.size;
}

/**
 * Remove one or more tags from every item in a library.
 * Returns the number of distinct items touched.
 */
async function deleteTags(
  libraryID: number,
  names: string[],
): Promise<number> {
  const touched = new Set<number>();
  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;
    const items = await getItemsWithTag(libraryID, name);
    for (const item of items) {
      item.removeTag(name);
      touched.add(item.id);
    }
    await saveItems(items);
  }
  return touched.size;
}
