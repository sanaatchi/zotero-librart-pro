// Adapted from zotero-style (AGPL-3.0) src/modules/graphView.ts — getGraphByItemArrLink / getGraphByTagLink

export type TagCooccurrencePair = {
  a: number;
  b: number;
  sharedTags: string[];
};

/**
 * Port of zotero-style's getGraphByItemArrLink: items sharing tag values get
 * pairwise links; dense tags (90th percentile of co-occurrence size) also get
 * hub nodes in the original UI — here we only emit item↔item edges with viaTags.
 */
export function getTagCooccurrencePairs(
  items: Zotero.Item[],
  getArr: (item: Zotero.Item) => string[],
  percentile = 0.9,
): TagCooccurrencePair[] {
  const sharedValues: { [key: string]: { items: Set<Zotero.Item> } } = {};

  items.forEach((item) => {
    const values = getArr(item);
    values.forEach((value: string) => {
      if (!Object.prototype.hasOwnProperty.call(sharedValues, value)) {
        sharedValues[value] = { items: new Set() };
      }
      sharedValues[value].items.add(item);
    });
  });

  const countArr = Object.values(sharedValues)
    .map((i) => i.items.size)
    .filter((i) => i > 1)
    .sort((a, b) => a - b);
  const limit =
    countArr.length > 0
      ? countArr[
          Math.min(
            countArr.length - 1,
            Math.floor(countArr.length * percentile),
          )
        ]
      : Infinity;

  const pairMap = new Map<
    string,
    { a: number; b: number; sharedTags: string[] }
  >();

  Object.keys(sharedValues).forEach((value: string) => {
    const group = [...sharedValues[value].items];
    if (group.length < 2) return;
    // Original still links all pairs; hub nodes only when group.length >= limit.
    const include =
      group.length < limit || group.length === 2 || group.length <= 5;
    if (!include && group.length >= limit) {
      // Skip ultra-dense tag cliques (hairball) — same intent as our v1 cap.
      return;
    }
    group.forEach((item) => {
      group
        .filter((i) => i.id !== item.id)
        .forEach((_item) => {
          const a = Math.min(item.id, _item.id);
          const b = Math.max(item.id, _item.id);
          const key = `${a}::${b}`;
          let pair = pairMap.get(key);
          if (!pair) {
            pair = { a, b, sharedTags: [] };
            pairMap.set(key, pair);
          }
          if (!pair.sharedTags.includes(value)) {
            pair.sharedTags.push(value);
          }
        });
    });
  });

  return [...pairMap.values()];
}

/** Tag extractor from zotero-style getGraphByTagLink. */
export function getItemTagValues(item: Zotero.Item): string[] {
  const allTags = item
    .getTags()
    .map((tag) => tag.tag)
    .filter((i) => !i.startsWith("/"));
  const tags: string[] = [];
  allTags.forEach((tag) => {
    tags.push(tag);
    tag.split("/").forEach((i) => {
      if (i) tags.push(i);
    });
  });
  return tags;
}
