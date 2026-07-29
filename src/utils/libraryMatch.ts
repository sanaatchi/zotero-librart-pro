export { searchItemByDoi, searchItemByTitle };

/**
 * Exact DOI match, case variants (some records store DOI upper/lowercase
 * inconsistently) — algorithm re-derived from zotero-reference's
 * Utils.searchItem, not copied.
 */
async function searchItemByDoi(
  doi: string,
  libraryID?: number,
): Promise<Zotero.Item | null> {
  const clean = doi.trim();
  if (!clean) return null;
  libraryID = libraryID ?? Zotero.Libraries.userLibraryID;

  const s = new Zotero.Search({ libraryID });
  s.addCondition("joinMode", "any");
  for (const variant of [clean, clean.toLowerCase(), clean.toUpperCase()]) {
    s.addCondition("DOI", "is", variant);
  }
  const ids = await s.search();
  const items = Zotero.Items.get(ids).filter((i) => i.isRegularItem());
  return items[0] || null;
}

function pureText(s: string): string {
  return (s || "").toLocaleLowerCase("tr").replace(/[^0-9a-zçğıöşü]/gi, "");
}

/**
 * Normalized substring fuzzy match — same idea as zotero-reference's
 * searchLibraryItem: strip to alphanumerics, check containment either
 * direction. Not real edit-distance fuzzy scoring, just a cheap filter.
 */
async function searchItemByTitle(
  title: string,
  libraryID?: number,
): Promise<Zotero.Item | null> {
  const clean = title.trim();
  if (clean.length < 10) return null;
  libraryID = libraryID ?? Zotero.Libraries.userLibraryID;

  const s = new Zotero.Search({ libraryID });
  s.addCondition("title", "contains", clean.slice(0, 60));
  const ids = await s.search();
  const items = Zotero.Items.get(ids).filter((i) => i.isRegularItem());

  const target = pureText(clean);
  for (const item of items) {
    const itemTitle = pureText((item.getField("title") as string) || "");
    if (!itemTitle) continue;
    if (itemTitle.includes(target) || target.includes(itemTitle)) {
      return item;
    }
  }
  return items[0] || null;
}
