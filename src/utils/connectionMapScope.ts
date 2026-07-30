// @ajan: cursor · @etiket: connection-map, scope, perf
/**
 * Resolve which items feed Bağlantı Haritası.
 * Prefer selection → collection → capped library (no full-library hairball).
 */

export type ConnectionMapScopeKind = "selection" | "collection" | "library-cap";

export type ConnectionMapScope = {
  kind: ConnectionMapScopeKind;
  /** Display label (collection name or short description). */
  label: string;
  itemIDs: number[];
  truncated: boolean;
  totalAvailable: number;
};

/** Soft ceiling — force layout + SVG stay usable. */
export const CONNECTION_MAP_MAX_NODES = 120;

export { resolveConnectionMapScope, expandRelated };

function regularLive(
  item: Zotero.Item | false | undefined | null,
): item is Zotero.Item {
  return Boolean(item && item.isRegularItem() && !item.deleted);
}

function capIds(
  ids: number[],
  max: number,
): { ids: number[]; truncated: boolean } {
  if (ids.length <= max) return { ids, truncated: false };
  return { ids: ids.slice(0, max), truncated: true };
}

function expandRelated(seed: Zotero.Item[]): number[] {
  const ids = new Set<number>();
  for (const item of seed) {
    ids.add(item.id);
    const related = item.relatedItems || [];
    for (const relatedKey of related) {
      // BUG FIX: was falling back through a caller-supplied `libraryID`
      // first. Zotero item keys are only unique *within* a library, so
      // looking a relatedKey up in the wrong library could silently
      // resolve to a completely unrelated item there instead of failing
      // through to the correct lookup. `item.libraryID` is always the
      // right library for this item's own relatedItems — no outer
      // libraryID needed.
      const rel = Zotero.Items.getByLibraryAndKey(item.libraryID, relatedKey);
      if (regularLive(rel)) ids.add(rel.id);
    }
  }
  return [...ids];
}

function scoreForCap(item: Zotero.Item): number {
  const related = (item.relatedItems || []).length;
  let tags = 0;
  try {
    tags = (item.getTags?.() || []).length;
  } catch {
    tags = 0;
  }
  return related * 3 + tags;
}

async function resolveConnectionMapScope(
  libraryID: number,
): Promise<ConnectionMapScope> {
  const pane = Zotero.getActiveZoteroPane?.() ?? null;

  const selected =
    pane
      ?.getSelectedItems?.()
      ?.filter((item: Zotero.Item) => regularLive(item)) ?? [];
  if (selected.length >= 1) {
    const expanded = expandRelated(selected);
    const { ids, truncated } = capIds(expanded, CONNECTION_MAP_MAX_NODES);
    return {
      kind: "selection",
      label: `selection:${selected.length}`,
      itemIDs: ids,
      truncated,
      totalAvailable: expanded.length,
    };
  }

  const collection = pane?.getSelectedCollection?.() ?? null;
  if (collection) {
    const children =
      (
        collection as {
          getChildItems?: (recursive?: boolean) => Zotero.Item[];
        }
      ).getChildItems?.(true) || [];
    const regular = children.filter((item) => regularLive(item));
    const expanded = expandRelated(regular);
    const { ids, truncated } = capIds(expanded, CONNECTION_MAP_MAX_NODES);
    const name =
      typeof (collection as { name?: string }).name === "string"
        ? String((collection as { name?: string }).name)
        : "collection";
    return {
      kind: "collection",
      label: name,
      itemIDs: ids,
      truncated: truncated || regular.length > ids.length,
      totalAvailable: Math.max(expanded.length, regular.length),
    };
  }

  const allItems = await Zotero.Items.getAll(libraryID);
  const regular = allItems.filter((item) => regularLive(item));
  const ranked = [...regular].sort(
    (a, b) => scoreForCap(b) - scoreForCap(a) || a.id - b.id,
  );
  const { ids, truncated } = capIds(
    ranked.map((item) => item.id),
    CONNECTION_MAP_MAX_NODES,
  );
  return {
    kind: "library-cap",
    label: "library",
    itemIDs: ids,
    truncated: truncated || regular.length > CONNECTION_MAP_MAX_NODES,
    totalAvailable: regular.length,
  };
}
