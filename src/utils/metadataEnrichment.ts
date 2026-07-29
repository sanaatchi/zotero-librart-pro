import { lookupEdition, EditionRecord } from "./localBookDb";
import { assignCitationKey } from "./citationKey";

export {
  ITEM_TYPE_REGISTRY,
  isSupportedForEnrichment,
  findItemsMissingMetadata,
  previewEnrichment,
  applyEnrichment,
  detectUnregisteredItemTypes,
};

export type EnrichmentSource = "book-db" | "unsupported";

export type ItemTypePackage = {
  itemType: string;
  /** Zotero field used to look up the item in an external catalog, if any. */
  identifierField: string | null;
  source: EnrichmentSource;
  /** Fields this package can fill when `source` has a working backend. */
  targetFields: string[];
};

/**
 * One entry per Zotero item type actually seen in this library (surveyed via
 * the local zotero.sqlite: book 445, journalArticle 391, thesis 23,
 * webpage 8, bookSection 7, tvBroadcast/magazineArticle/document 3 each,
 * report/film 2 each, videoRecording/newspaperArticle 1 each).
 *
 * Only `book`/`bookSection` carry an ISBN and a publisher/place/date shape
 * compatible with a book-catalog lookup (kitaplar.db/openlibrary.db). The
 * rest need a different identifier (DOI) and/or data source that isn't
 * built yet — registered as "unsupported" on purpose, not silently
 * ignored, so `detectUnregisteredItemTypes` never re-flags them as unknown.
 */
const ITEM_TYPE_REGISTRY: Record<string, ItemTypePackage> = {
  book: {
    itemType: "book",
    identifierField: "ISBN",
    source: "book-db",
    targetFields: ["publisher", "place", "date"],
  },
  bookSection: {
    itemType: "bookSection",
    identifierField: "ISBN",
    source: "book-db",
    targetFields: ["publisher", "place", "date"],
  },
  journalArticle: {
    itemType: "journalArticle",
    identifierField: "DOI",
    source: "unsupported",
    targetFields: ["publicationTitle", "volume", "issue", "ISSN"],
  },
  thesis: {
    itemType: "thesis",
    identifierField: null,
    source: "unsupported",
    targetFields: ["university", "place", "date"],
  },
  webpage: { itemType: "webpage", identifierField: null, source: "unsupported", targetFields: [] },
  tvBroadcast: { itemType: "tvBroadcast", identifierField: null, source: "unsupported", targetFields: [] },
  magazineArticle: { itemType: "magazineArticle", identifierField: null, source: "unsupported", targetFields: ["publicationTitle"] },
  document: { itemType: "document", identifierField: null, source: "unsupported", targetFields: [] },
  report: { itemType: "report", identifierField: null, source: "unsupported", targetFields: ["place", "date"] },
  film: { itemType: "film", identifierField: null, source: "unsupported", targetFields: [] },
  videoRecording: { itemType: "videoRecording", identifierField: null, source: "unsupported", targetFields: [] },
  newspaperArticle: { itemType: "newspaperArticle", identifierField: null, source: "unsupported", targetFields: ["publicationTitle"] },
};

const BOOK_PACKAGE_TYPES = Object.values(ITEM_TYPE_REGISTRY)
  .filter((p) => p.source === "book-db")
  .map((p) => p.itemType);

function isSupportedForEnrichment(item: Zotero.Item): boolean {
  return BOOK_PACKAGE_TYPES.includes(item.itemType);
}

/**
 * Scan the library for item types not present in ITEM_TYPE_REGISTRY —
 * surfaced in the dashboard so a newly-added or newly-used Zotero item
 * type doesn't silently fall through enrichment forever. Registering a
 * detected type just means adding one entry to ITEM_TYPE_REGISTRY above.
 */
async function detectUnregisteredItemTypes(
  libraryID?: number,
): Promise<string[]> {
  libraryID = libraryID ?? Zotero.Libraries.userLibraryID;
  const allItems = await Zotero.Items.getAll(libraryID);
  const seen = new Set<string>();
  for (const item of allItems) {
    if (item.deleted) continue;
    if (!item.isRegularItem?.()) continue; // skip attachment/note/annotation
    seen.add(item.itemType);
  }
  return [...seen].filter((t) => !ITEM_TYPE_REGISTRY[t]).sort();
}

export type EnrichmentProposal = {
  itemID: number;
  title: string;
  isbn: string;
  current: { publisher?: string; place?: string; date?: string };
  proposed: { publisher?: string; place?: string; date?: string };
  source: EditionRecord["source"];
};

/** Book/bookSection items with an ISBN but a missing publisher or date. */
async function findItemsMissingMetadata(
  libraryID?: number,
): Promise<Zotero.Item[]> {
  libraryID = libraryID ?? Zotero.Libraries.userLibraryID;
  const allItems = await Zotero.Items.getAll(libraryID);
  return allItems.filter((item) => {
    if (item.deleted || !isSupportedForEnrichment(item)) return false;
    const pkg = ITEM_TYPE_REGISTRY[item.itemType];
    const isbn = pkg?.identifierField
      ? (item.getField(pkg.identifierField) as string)
      : "";
    if (!isbn) return false;
    const missingPublisher = !item.getField("publisher");
    const missingDate = !item.getField("date");
    return missingPublisher || missingDate;
  });
}

/** Look up candidates without writing anything — for user review. */
async function previewEnrichment(
  items: Zotero.Item[],
): Promise<EnrichmentProposal[]> {
  const proposals: EnrichmentProposal[] = [];
  for (const item of items) {
    const pkg = ITEM_TYPE_REGISTRY[item.itemType];
    const isbn = pkg?.identifierField
      ? (item.getField(pkg.identifierField) as string)
      : "";
    if (!isbn) continue;
    const record = await lookupEdition(isbn);
    if (!record) continue;

    const current = {
      publisher: (item.getField("publisher") as string) || undefined,
      place: (item.getField("place") as string) || undefined,
      date: (item.getField("date") as string) || undefined,
    };
    const proposed = {
      publisher: !current.publisher ? record.publisher : undefined,
      place: !current.place ? record.publishCity : undefined,
      date: !current.date ? record.publishDate : undefined,
    };
    if (!proposed.publisher && !proposed.place && !proposed.date) continue;

    proposals.push({
      itemID: item.id,
      title: item.getDisplayTitle() || item.getField("title") || "",
      isbn,
      current,
      proposed,
      source: record.source,
    });
  }
  return proposals;
}

/**
 * Write the approved fields for each proposal. `fields` limits which
 * columns get written (e.g. user unchecked "place" in the preview UI).
 */
async function applyEnrichment(
  proposals: EnrichmentProposal[],
  fields: Array<"publisher" | "place" | "date"> = ["publisher", "place", "date"],
): Promise<number> {
  const items = proposals
    .map((p) => ({ p, item: Zotero.Items.get(p.itemID) }))
    .filter((x): x is { p: EnrichmentProposal; item: Zotero.Item } => !!x.item);
  if (!items.length) return 0;

  let touched = 0;
  const enrichedItems: Zotero.Item[] = [];
  await Zotero.DB.executeTransaction(async () => {
    for (const { p, item } of items) {
      let changed = false;
      for (const field of fields) {
        const value = p.proposed[field];
        if (!value) continue;
        item.setField(field, value);
        changed = true;
      }
      if (changed) {
        await item.save();
        touched++;
        enrichedItems.push(item);
      }
    }
  });

  // Separate step (own saveTx per item) — assignCitationKey manages its
  // own save and shouldn't nest inside the batch executeTransaction above.
  for (const item of enrichedItems) {
    try {
      await assignCitationKey(item);
    } catch (e) {
      ztoolkit.log("Citation key assignment failed", item.id, e);
    }
  }

  return touched;
}
