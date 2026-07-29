import { lookupEdition, EditionRecord } from "./localBookDb";
import { resolveByDoi, DoiRecord } from "./doiResolver";
import { assignCitationKey } from "./citationKey";

export {
  ITEM_TYPE_REGISTRY,
  isSupportedForEnrichment,
  findItemsMissingMetadata,
  previewEnrichment,
  applyEnrichment,
  detectUnregisteredItemTypes,
};

export type EnrichmentSource = "book-db" | "doi-lookup" | "unsupported";

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
 * `book`/`bookSection` carry an ISBN and a publisher/place/date shape
 * compatible with a book-catalog lookup (kitaplar.db/openlibrary.db).
 * `journalArticle` carries a DOI, resolved via Crossref/Semantic
 * Scholar/arXiv (doiResolver.ts). The rest have neither a usable
 * identifier nor a matching data source yet — registered as
 * "unsupported" on purpose, not silently ignored, so
 * `detectUnregisteredItemTypes` never re-flags them as unknown.
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
    source: "doi-lookup",
    targetFields: ["publicationTitle", "volume", "issue"],
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

const SUPPORTED_TYPES = Object.values(ITEM_TYPE_REGISTRY)
  .filter((p) => p.source !== "unsupported")
  .map((p) => p.itemType);

function isSupportedForEnrichment(item: Zotero.Item): boolean {
  return SUPPORTED_TYPES.includes(item.itemType);
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
  identifier: string;
  current: Record<string, string | undefined>;
  proposed: Record<string, string | undefined>;
  source: EditionRecord["source"] | DoiRecord["source"];
};

/** Items whose package has an identifier present but at least one target field empty. */
async function findItemsMissingMetadata(
  libraryID?: number,
): Promise<Zotero.Item[]> {
  libraryID = libraryID ?? Zotero.Libraries.userLibraryID;
  const allItems = await Zotero.Items.getAll(libraryID);
  return allItems.filter((item) => {
    if (item.deleted || !isSupportedForEnrichment(item)) return false;
    const pkg = ITEM_TYPE_REGISTRY[item.itemType];
    const identifier = pkg?.identifierField
      ? (item.getField(pkg.identifierField) as string)
      : "";
    if (!identifier) return false;
    return pkg.targetFields.some((f) => !item.getField(f));
  });
}

async function previewOne(
  item: Zotero.Item,
  pkg: ItemTypePackage,
): Promise<EnrichmentProposal | null> {
  const identifier = pkg.identifierField
    ? (item.getField(pkg.identifierField) as string)
    : "";
  if (!identifier) return null;

  let fields: Record<string, string | undefined> | null = null;
  let source: EnrichmentProposal["source"] | null = null;

  if (pkg.source === "book-db") {
    const record = await lookupEdition(identifier);
    if (!record) return null;
    fields = {
      publisher: record.publisher,
      place: record.publishCity,
      date: record.publishDate,
    };
    source = record.source;
  } else if (pkg.source === "doi-lookup") {
    const record = await resolveByDoi(identifier);
    if (!record) return null;
    fields = {
      publicationTitle: record.publicationTitle,
      volume: record.volume,
      issue: record.issue,
    };
    source = record.source;
  }
  if (!fields || !source) return null;

  const current: Record<string, string | undefined> = {};
  const proposed: Record<string, string | undefined> = {};
  let hasProposal = false;
  for (const f of pkg.targetFields) {
    const existing = (item.getField(f) as string) || undefined;
    current[f] = existing;
    if (!existing && fields[f]) {
      proposed[f] = fields[f];
      hasProposal = true;
    }
  }
  if (!hasProposal) return null;

  return {
    itemID: item.id,
    title: item.getDisplayTitle() || item.getField("title") || "",
    identifier,
    current,
    proposed,
    source,
  };
}

/** Look up candidates without writing anything — for user review. */
async function previewEnrichment(
  items: Zotero.Item[],
): Promise<EnrichmentProposal[]> {
  const proposals: EnrichmentProposal[] = [];
  for (const item of items) {
    const pkg = ITEM_TYPE_REGISTRY[item.itemType];
    if (!pkg) continue;
    const proposal = await previewOne(item, pkg);
    if (proposal) proposals.push(proposal);
  }
  return proposals;
}

/**
 * Write the approved fields for each proposal. `fields` limits which
 * columns get written (e.g. user unchecked "place" in the preview UI).
 * Omit to write every proposed field.
 */
async function applyEnrichment(
  proposals: EnrichmentProposal[],
  fields?: string[],
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
      const allowed = fields ?? Object.keys(p.proposed);
      for (const field of allowed) {
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
  // Only meaningful for book/bookSection (ISBN-based); no-op otherwise
  // since assignCitationKey falls back to a fresh CKxxxxxx code either way.
  for (const item of enrichedItems) {
    try {
      await assignCitationKey(item);
    } catch (e) {
      ztoolkit.log("Citation key assignment failed", item.id, e);
    }
  }

  return touched;
}
