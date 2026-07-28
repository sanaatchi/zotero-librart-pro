export type TagCategory = "concept" | "person" | "place" | "system";

export type TagStat = {
  name: string;
  count: number;
};

export type TagPair = {
  a: TagStat;
  b: TagStat;
  score: number;
};

export type TagAnalysisReport = {
  libraryID: number;
  libraryName: string;
  summary: {
    totalTags: number;
    totalLinks: number;
    libraryItems: number;
    taggedItems: number;
    untaggedItems: number;
    unusedTags: number;
    singletonTags: number;
    heavyTags: number;
    avgTagsPerTaggedItem: number;
    categories: Record<TagCategory, number>;
  };
  topTags: TagStat[];
  tagCountDistribution: { label: string; value: number }[];
  foldDupes: TagStat[][];
  fuzzyNear: TagPair[];
  bilingualPairs: { en: TagStat; tr: TagStat }[];
  generatedAt: string;
};

const SYSTEM_TAGS = new Set([
  "#pdf-review",
  "atıf yapıldı",
  "ISBN yok",
  "ISBN Added",
  "Metadata Updated",
  "Zotero çevirmeni",
  "archived",
  "okunacak",
  "No ISBN Found",
  "Via Zotero Translator",
  "Data scrubbing",
]);

const PLACE_HINTS = new Set([
  "turkiye",
  "abd",
  "avrupa",
  "almanya",
  "ingiltere",
  "istanbul",
  "ankara",
  "fransa",
  "italya",
  "rusya",
  "japonya",
  "cin",
  "irlanda",
  "isvicre",
  "norvec",
  "avustralya",
  "mexico",
  "orta dogu",
  "guney asya",
  "suriye",
  "hatay",
  "konya",
  "selcuklular",
]);

const PLACE_NAMES = new Set([
  "Türkiye",
  "ABD",
  "Avrupa",
  "Fransa",
  "İtalya",
  "Rusya",
  "Japonya",
  "Çin",
]);

const BILINGUAL: [string, string][] = [
  ["art", "sanat"],
  ["photography", "fotograf"],
  ["impressionism", "empresyonizm"],
  ["education", "egitim"],
  ["philosophy", "felsefe"],
  ["history", "tarih"],
  ["culture", "kultur"],
  ["society", "toplum"],
  ["politics", "politika"],
  ["science", "bilim"],
  ["literature", "edebiyat"],
  ["painting", "resim"],
  ["music", "muzik"],
  ["sculpture", "heykel"],
];

export { similarity };

export function foldTag(s: string): string {
  let out = (s || "").normalize("NFKC").toLocaleLowerCase("tr").trim();
  const map: Record<string, string> = {
    ı: "i",
    i̇: "i",
    ş: "s",
    ğ: "g",
    ü: "u",
    ö: "o",
    ç: "c",
  };
  out = out.replace(/[ıi̇şğüöç]/g, (ch) => map[ch] || ch);
  out = out.replace(/[\s_\-–—/]+/g, " ");
  return out.replace(/\s+/g, " ").trim();
}

function categorize(name: string, count: number): TagCategory {
  const f = foldTag(name);
  if (SYSTEM_TAGS.has(name) || name.startsWith("#")) return "system";
  if (PLACE_HINTS.has(f) || PLACE_NAMES.has(name)) return "place";
  const looksProper =
    /^[A-ZÀ-ÖØ-Þİ]/.test(name) &&
    ((name.includes(" ") && count <= 5) ||
      (count <= 3 &&
        name.length > 3 &&
        !["sanat", "egitim", "felsefe", "kultur", "toplum", "politika"].some(
          (x) => f.includes(x),
        )));
  if (looksProper) return "person";
  return "concept";
}

/** Dice coefficient on character bigrams — close enough for near-dupe ranking. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const [g, c] of A) {
    const d = B.get(g);
    if (d) inter += Math.min(c, d);
  }
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

/**
 * Zotero.DB.queryAsync returns undefined when SQL has leading whitespace
 * (it peeks at the first chars for SELECT/INSERT) or when there are no rows.
 */
async function queryRows<T extends Record<string, unknown>>(
  sql: string,
  params?: (string | number)[],
): Promise<T[]> {
  const rows = await Zotero.DB.queryAsync(sql.trim(), params);
  return (rows as T[] | undefined) ?? [];
}

export async function analyzeLibraryTags(
  libraryID?: number,
): Promise<TagAnalysisReport> {
  libraryID = libraryID ?? Zotero.Libraries.userLibraryID;
  const library = Zotero.Libraries.get(libraryID);
  const libraryName =
    library && typeof library === "object" && "name" in library
      ? String((library as { name?: string }).name || libraryID)
      : String(libraryID);

  const tagRows = await queryRows<{ name: string; cnt: number | string }>(
    `
    SELECT t.name AS name, COUNT(it.itemID) AS cnt
    FROM tags t
    JOIN itemTags it ON it.tagID = t.tagID
    JOIN items i ON i.itemID = it.itemID
    JOIN itemTypes ty ON ty.itemTypeID = i.itemTypeID
    LEFT JOIN deletedItems d ON d.itemID = i.itemID
    WHERE i.libraryID = ?
      AND d.itemID IS NULL
      AND ty.typeName NOT IN ('attachment', 'note', 'annotation')
    GROUP BY t.name
    ORDER BY cnt DESC, t.name COLLATE NOCASE
    `,
    [libraryID],
  );

  const tags: TagStat[] = tagRows.map((r) => ({
    name: r.name,
    count: Number(r.cnt) || 0,
  }));

  const unusedRows = await queryRows<{ n: number | string }>(
    `
    SELECT COUNT(*) AS n FROM (
      SELECT t.tagID
      FROM tags t
      LEFT JOIN itemTags it ON it.tagID = t.tagID
      LEFT JOIN items i ON i.itemID = it.itemID AND i.libraryID = ?
      LEFT JOIN deletedItems d ON d.itemID = i.itemID
      GROUP BY t.tagID
      HAVING COUNT(CASE WHEN d.itemID IS NULL THEN i.itemID END) = 0
    ) unused_tags
    `,
    [libraryID],
  );
  const unusedTags = Number(unusedRows[0]?.n) || 0;

  const itemRows = await queryRows<{ n: number | string }>(
    `
    SELECT COUNT(*) AS n FROM items i
    JOIN itemTypes ty ON ty.itemTypeID = i.itemTypeID
    LEFT JOIN deletedItems d ON d.itemID = i.itemID
    WHERE i.libraryID = ?
      AND d.itemID IS NULL
      AND ty.typeName NOT IN ('attachment', 'note', 'annotation')
    `,
    [libraryID],
  );
  const libraryItems = Number(itemRows[0]?.n) || 0;

  const taggedRows = await queryRows<{ n: number | string }>(
    `
    SELECT COUNT(DISTINCT it.itemID) AS n
    FROM itemTags it
    JOIN items i ON i.itemID = it.itemID
    JOIN itemTypes ty ON ty.itemTypeID = i.itemTypeID
    LEFT JOIN deletedItems d ON d.itemID = i.itemID
    WHERE i.libraryID = ?
      AND d.itemID IS NULL
      AND ty.typeName NOT IN ('attachment', 'note', 'annotation')
    `,
    [libraryID],
  );
  const taggedItems = Number(taggedRows[0]?.n) || 0;

  const distRows = await queryRows<{
    n: number | string;
    items: number | string;
  }>(
    `
    SELECT tag_count AS n, COUNT(*) AS items
    FROM (
      SELECT i.itemID, COUNT(it.tagID) AS tag_count
      FROM items i
      JOIN itemTypes ty ON ty.itemTypeID = i.itemTypeID
      LEFT JOIN itemTags it ON it.itemID = i.itemID
      LEFT JOIN deletedItems d ON d.itemID = i.itemID
      WHERE i.libraryID = ?
        AND d.itemID IS NULL
        AND ty.typeName NOT IN ('attachment', 'note', 'annotation')
      GROUP BY i.itemID
    ) per_item
    GROUP BY tag_count
    ORDER BY tag_count
    `,
    [libraryID],
  );
  const distMap = new Map<number, number>();
  for (const row of distRows) {
    distMap.set(Number(row.n) || 0, Number(row.items) || 0);
  }
  const tagCountDistribution: { label: string; value: number }[] = [];
  let plus13 = 0;
  for (let i = 0; i <= 12; i++) {
    tagCountDistribution.push({ label: String(i), value: distMap.get(i) || 0 });
  }
  for (const [n, v] of distMap) {
    if (n >= 13) plus13 += v;
  }
  tagCountDistribution.push({ label: "13+", value: plus13 });
  // Drop empty leading zeros for cleaner chart? Keep 0 for untagged visibility.
  while (
    tagCountDistribution.length &&
    tagCountDistribution[0].label !== "0" &&
    tagCountDistribution[0].value === 0
  ) {
    tagCountDistribution.shift();
  }

  const totalLinks = tags.reduce((s, t) => s + t.count, 0);
  const singletonTags = tags.filter((t) => t.count === 1).length;
  const heavyTags = tags.filter((t) => t.count >= 20).length;
  const avgTagsPerTaggedItem =
    taggedItems > 0 ? Math.round((totalLinks / taggedItems) * 100) / 100 : 0;

  const categories: Record<TagCategory, number> = {
    concept: 0,
    person: 0,
    place: 0,
    system: 0,
  };
  for (const t of tags) {
    categories[categorize(t.name, t.count)] += 1;
  }

  const byFold = new Map<string, TagStat[]>();
  for (const t of tags) {
    const f = foldTag(t.name);
    const list = byFold.get(f) || [];
    list.push(t);
    byFold.set(f, list);
  }
  const foldDupes: TagStat[][] = [];
  for (const group of byFold.values()) {
    const names = new Set(group.map((g) => g.name));
    if (names.size > 1) foldDupes.push(group.sort((a, b) => b.count - a.count));
  }
  foldDupes.sort((a, b) => {
    const sa = a.reduce((s, t) => s + t.count, 0);
    const sb = b.reduce((s, t) => s + t.count, 0);
    return sb - sa;
  });

  const fuzzyNear: TagPair[] = [];
  const candidates = tags.filter((t) => t.count >= 1 && t.name.length >= 4);
  const buckets = new Map<string, Array<TagStat & { f: string }>>();
  for (const t of candidates) {
    const f = foldTag(t.name);
    const key = f.slice(0, 2) || f;
    const list = buckets.get(key) || [];
    list.push({ ...t, f });
    buckets.set(key, list);
  }
  const seen = new Set<string>();
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        if (a.f === b.f) continue;
        let score = similarity(a.f, b.f);
        const [shorter, longer] =
          a.f.length <= b.f.length ? [a.f, b.f] : [b.f, a.f];
        if (longer.includes(shorter) && shorter.length >= 5) {
          score = Math.max(score, 0.9);
        }
        if (score < 0.88) continue;
        const pairKey = [a.name, b.name].sort().join("\0");
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        fuzzyNear.push({
          score: Math.round(score * 1000) / 1000,
          a: { name: a.name, count: a.count },
          b: { name: b.name, count: b.count },
        });
      }
    }
  }
  fuzzyNear.sort((x, y) => y.score - x.score);

  const tagByFold = new Map<string, TagStat>();
  for (const t of tags) {
    const f = foldTag(t.name);
    const prev = tagByFold.get(f);
    if (!prev || t.count > prev.count) tagByFold.set(f, t);
  }
  const bilingualPairs: { en: TagStat; tr: TagStat }[] = [];
  for (const [enFold, trFold] of BILINGUAL) {
    const en = tagByFold.get(enFold);
    const tr = tagByFold.get(trFold);
    if (en && tr && en.name !== tr.name) {
      bilingualPairs.push({ en, tr });
    }
  }

  return {
    libraryID,
    libraryName,
    summary: {
      totalTags: tags.length,
      totalLinks,
      libraryItems,
      taggedItems,
      untaggedItems: Math.max(0, libraryItems - taggedItems),
      unusedTags,
      singletonTags,
      heavyTags,
      avgTagsPerTaggedItem,
      categories,
    },
    topTags: tags.slice(0, 15),
    tagCountDistribution,
    foldDupes: foldDupes.slice(0, 20),
    fuzzyNear: fuzzyNear.slice(0, 20),
    bilingualPairs,
    generatedAt: new Date().toISOString(),
  };
}
