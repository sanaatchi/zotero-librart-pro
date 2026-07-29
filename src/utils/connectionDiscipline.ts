import { foldTag } from "./tagAnalysis";
import {
  DisciplineProfile,
  GraphNode,
  UNSORTED_DISCIPLINE_LABEL,
} from "./connectionGraph";

export { inferDisciplineProfile };

/**
 * Lightweight discipline lexicon — folded keys map to canonical labels.
 * Collection names and item tags are scored against this table.
 */
const DISCIPLINE_LEXICON: Array<{ label: string; keys: string[] }> = [
  {
    label: "Sosyoloji",
    keys: ["sosyoloji", "sociology", "toplum", "society", "social"],
  },
  {
    label: "Felsefe",
    keys: ["felsefe", "philosophy", "ontology", "epistemology", "etik", "ethics"],
  },
  {
    label: "Sanat tarihi",
    keys: [
      "sanat",
      "art",
      "art history",
      "sanat tarihi",
      "painting",
      "sculpture",
      "visual culture",
    ],
  },
  {
    label: "Edebiyat",
    keys: ["edebiyat", "literature", "literary", "poetry", "roman", "novel"],
  },
  {
    label: "Tarih",
    keys: ["tarih", "history", "historical", "historiography"],
  },
  {
    label: "Psikoloji",
    keys: ["psikoloji", "psychology", "cognitive", "bilissel"],
  },
  {
    label: "Antropoloji",
    keys: ["antropoloji", "anthropology", "ethnography", "etnografi"],
  },
  {
    label: "Siyaset",
    keys: ["siyaset", "politics", "political", "policy", "governance"],
  },
  {
    label: "Ekonomi",
    keys: ["ekonomi", "economics", "economy", "iktisat"],
  },
  {
    label: "Mimarlık",
    keys: ["mimarlik", "architecture", "urban", "kent"],
  },
  {
    label: "Medya",
    keys: ["medya", "media", "communication", "iletisim", "film", "cinema"],
  },
  {
    label: "Eğitim",
    keys: ["egitim", "education", "pedagogy", "ogretim"],
  },
  {
    label: "Din",
    keys: ["din", "religion", "theology", "ilahiyat", "islam", "christian"],
  },
  {
    label: "Hukuk",
    keys: ["hukuk", "law", "legal", "jurisprudence"],
  },
  {
    label: "Bilim",
    keys: ["bilim", "science", "physics", "biology", "chemistry", "stem"],
  },
];

function scoreText(folded: string, keys: string[]): number {
  let score = 0;
  for (const key of keys) {
    const fk = foldTag(key);
    if (!fk) continue;
    if (folded === fk) score += 3;
    else if (folded.includes(fk) || fk.includes(folded)) score += 1.5;
  }
  return score;
}

/**
 * Infer a soft discipline profile from collection labels + item tags.
 * Falls back to primary collection label or Unsorted.
 */
function inferDisciplineProfile(
  item: Zotero.Item,
  collectionLabels: string[],
): DisciplineProfile {
  const scores: Record<string, number> = {};

  const bump = (label: string, amount: number) => {
    scores[label] = (scores[label] || 0) + amount;
  };

  for (const coll of collectionLabels) {
    if (!coll || coll === UNSORTED_DISCIPLINE_LABEL) continue;
    const folded = foldTag(coll);
    let matched = false;
    for (const entry of DISCIPLINE_LEXICON) {
      const s = scoreText(folded, entry.keys);
      if (s > 0) {
        bump(entry.label, s + 2); // collection membership is strong
        matched = true;
      }
    }
    if (!matched) {
      // Treat top-level collection name itself as a discipline bucket.
      bump(coll, 2.5);
    }
  }

  for (const t of item.getTags()) {
    const name = t.tag;
    if (!name || name.startsWith("/")) continue;
    const folded = foldTag(name);
    for (const entry of DISCIPLINE_LEXICON) {
      const s = scoreText(folded, entry.keys);
      if (s > 0) bump(entry.label, s);
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    const fallback =
      collectionLabels.find((l) => l && l !== UNSORTED_DISCIPLINE_LABEL) ||
      UNSORTED_DISCIPLINE_LABEL;
    return {
      primary: fallback,
      scores: { [fallback]: 1 },
      source: "collection",
    };
  }

  return {
    primary: ranked[0][0],
    scores: Object.fromEntries(ranked.slice(0, 6)),
    source: "tags",
  };
}

/** Attach profile onto an existing node (mutates). */
export function attachDisciplineProfile(node: GraphNode, item: Zotero.Item) {
  node.disciplineProfile = inferDisciplineProfile(
    item,
    node.disciplineLabels,
  );
}
