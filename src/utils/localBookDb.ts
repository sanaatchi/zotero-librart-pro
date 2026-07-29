import { getPref } from "./prefs";

export {
  isLocalBookDbConfigured,
  normalizeIsbnCandidates,
  lookupEdition,
  lookupSubjectsByIsbn,
  nextCkCode,
};

export type EditionRecord = {
  isbn: string;
  publisher?: string;
  publishDate?: string;
  publishCity?: string;
  subjects?: string[];
  /**
   * Kutuphane's own "KPxxxxxx" book-profile code, when the openlibrary.db
   * edition row was already cross-matched to it (editions.kitap_id).
   * Read-only — we never allocate or write into Kutuphane's KP registry.
   */
  kutuphaneKp?: string;
  source: "openlibrary" | "kitaplar" | "cache";
};

let inciteful: _ZoteroTypes.DBConnection | null | undefined;
let openLibrary: _ZoteroTypes.DBConnection | null | undefined;
let kitaplar: _ZoteroTypes.DBConnection | null | undefined;
let incitefulReady: Promise<void> | null = null;

/** Our own accumulating cache DB, stored in the Zotero profile directory. */
function getIncitefulDb(): _ZoteroTypes.DBConnection | null {
  if (inciteful !== undefined) return inciteful;
  try {
    const path = `${Zotero.DataDirectory.dir}/inciteful.db`;
    inciteful = new Zotero.DBConnection(path);
  } catch (e) {
    ztoolkit.log("Inciteful cache DB open failed", e);
    inciteful = null;
  }
  return inciteful;
}

async function ensureIncitefulSchema(): Promise<void> {
  if (incitefulReady) return incitefulReady;
  const db = getIncitefulDb();
  if (!db) return;
  incitefulReady = (async () => {
    try {
      await db.queryAsync(
        `CREATE TABLE IF NOT EXISTS editions_cache (
          isbn TEXT PRIMARY KEY,
          publisher TEXT,
          publish_date TEXT,
          publish_city TEXT,
          subjects TEXT,
          source TEXT,
          kutuphane_kp TEXT,
          found INTEGER NOT NULL DEFAULT 1,
          cached_at TEXT NOT NULL
        )`,
      );
      await db.queryAsync(
        `CREATE TABLE IF NOT EXISTS citekey_seq (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)`,
      );
      await db.queryAsync(
        `INSERT OR IGNORE INTO citekey_seq (id, value) VALUES (1, 0)`,
      );
    } catch (e) {
      ztoolkit.log("Inciteful cache schema init failed", e);
    }
  })();
  return incitefulReady;
}

/** Next sequential "CKxxxxxx" code — our own namespace, never Kutuphane's KP. */
async function nextCkCode(): Promise<string> {
  const db = getIncitefulDb();
  if (!db) throw new Error("Inciteful cache DB not configured");
  await ensureIncitefulSchema();
  await db.queryAsync("UPDATE citekey_seq SET value = value + 1 WHERE id = 1");
  const rows = await db.queryAsync(
    "SELECT value FROM citekey_seq WHERE id = 1",
  );
  const n = Number((rows?.[0] as Record<string, any> | undefined)?.value || 1);
  return `CK${String(n).padStart(6, "0")}`;
}

function getOpenLibraryDb(): _ZoteroTypes.DBConnection | null {
  if (openLibrary !== undefined) return openLibrary;
  const path = String(getPref("openLibraryDbPath") || "").trim();
  if (!path) {
    openLibrary = null;
    return null;
  }
  try {
    openLibrary = new Zotero.DBConnection(path);
  } catch (e) {
    ztoolkit.log("OpenLibrary DB open failed", e);
    openLibrary = null;
  }
  return openLibrary;
}

function getKitaplarDb(): _ZoteroTypes.DBConnection | null {
  if (kitaplar !== undefined) return kitaplar;
  const path = String(getPref("kitaplarDbPath") || "").trim();
  if (!path) {
    kitaplar = null;
    return null;
  }
  try {
    kitaplar = new Zotero.DBConnection(path);
  } catch (e) {
    ztoolkit.log("Kitaplar DB open failed", e);
    kitaplar = null;
  }
  return kitaplar;
}

/** True if at least one local source (cache or configured DB) can be queried. */
function isLocalBookDbConfigured(): boolean {
  return !!(getIncitefulDb() || getOpenLibraryDb() || getKitaplarDb());
}

/**
 * A Zotero ISBN field can hold multiple space/comma-separated ISBNs and
 * dashes. Return cleaned ISBN-10/13 candidates, longest (13) first.
 */
function normalizeIsbnCandidates(raw: string): string[] {
  if (!raw) return [];
  const tokens = raw.split(/[,;\s]+/).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const cleaned = t.replace(/[^0-9Xx]/g, "").toUpperCase();
    if (cleaned.length === 10 || cleaned.length === 13) out.push(cleaned);
  }
  return [...new Set(out)].sort((a, b) => b.length - a.length);
}

/** ALL CAPS "ILETISIM YAYINLARI" -> "İletişim Yayınları" (Turkish-aware). */
function toTitleCaseTr(s: string): string {
  const lower = s.toLocaleLowerCase("tr");
  return lower.replace(
    /(^|\s)(\p{L})/gu,
    (_, sep, ch) => sep + ch.toLocaleUpperCase("tr"),
  );
}

async function readCache(isbn: string): Promise<EditionRecord | null | "miss"> {
  const db = getIncitefulDb();
  if (!db) return "miss";
  await ensureIncitefulSchema();
  try {
    const rows = await db.queryAsync(
      "SELECT * FROM editions_cache WHERE isbn = ?",
      [isbn],
    );
    const row = rows?.[0] as Record<string, any> | undefined;
    if (!row) return "miss";
    if (!row.found) return null; // cached negative result
    return {
      isbn,
      publisher: row.publisher || undefined,
      publishDate: row.publish_date || undefined,
      publishCity: row.publish_city || undefined,
      subjects: row.subjects
        ? String(row.subjects).split(";").filter(Boolean)
        : undefined,
      kutuphaneKp: row.kutuphane_kp || undefined,
      source: "cache",
    };
  } catch (e) {
    ztoolkit.log("Inciteful cache read failed", e);
    return "miss";
  }
}

async function writeCache(
  isbn: string,
  record: EditionRecord | null,
): Promise<void> {
  const db = getIncitefulDb();
  if (!db) return;
  await ensureIncitefulSchema();
  try {
    await db.queryAsync(
      `INSERT OR REPLACE INTO editions_cache
        (isbn, publisher, publish_date, publish_city, subjects, source, kutuphane_kp, found, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        isbn,
        record?.publisher || null,
        record?.publishDate || null,
        record?.publishCity || null,
        record?.subjects?.join(";") || null,
        record?.source || "openlibrary",
        record?.kutuphaneKp || null,
        record ? 1 : 0,
        new Date().toISOString(),
      ],
    );
  } catch (e) {
    ztoolkit.log("Inciteful cache write failed", e);
  }
}

async function queryKitaplar(isbn: string): Promise<EditionRecord | null> {
  const db = getKitaplarDb();
  if (!db) return null;
  try {
    const rows = await db.queryAsync(
      "SELECT yayinevi, yayın_tarihi FROM kitaplar WHERE isbn = ? LIMIT 1",
      [isbn],
    );
    const row = rows?.[0] as Record<string, any> | undefined;
    if (!row?.yayinevi) return null;
    return {
      isbn,
      publisher: toTitleCaseTr(String(row.yayinevi)),
      publishDate: row["yayın_tarihi"] || undefined,
      source: "kitaplar",
    };
  } catch (e) {
    ztoolkit.log("Kitaplar DB query failed", e);
    return null;
  }
}

async function queryOpenLibrary(isbn: string): Promise<EditionRecord | null> {
  const db = getOpenLibraryDb();
  if (!db) return null;
  try {
    const rows = await db.queryAsync(
      `SELECT publishers, publish_date, publish_city, subjects, kitap_id
       FROM editions WHERE isbn_13 = ? OR isbn_10 = ? LIMIT 1`,
      [isbn, isbn],
    );
    const row = rows?.[0] as Record<string, any> | undefined;
    if (!row) return null;
    return {
      isbn,
      publisher: row.publishers || undefined,
      publishDate: row.publish_date || undefined,
      publishCity: row.publish_city || undefined,
      kutuphaneKp: row.kitap_id || undefined,
      subjects: row.subjects
        ? String(row.subjects)
            .split(";")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined,
      source: "openlibrary",
    };
  } catch (e) {
    ztoolkit.log("OpenLibrary DB query failed", e);
    return null;
  }
}

/**
 * Cache-first lookup: Inciteful.db -> kitaplar.db -> openlibrary.db.
 * A hit from either external DB is written back to Inciteful.db so the
 * 30GB openlibrary.db file only has to be opened once per ISBN, ever.
 */
async function lookupEdition(rawIsbn: string): Promise<EditionRecord | null> {
  const candidates = normalizeIsbnCandidates(rawIsbn);
  if (!candidates.length) return null;

  for (const isbn of candidates) {
    const cached = await readCache(isbn);
    if (cached === null) continue; // cached negative — try next candidate
    if (cached !== "miss") return cached;

    const fromKitaplar = await queryKitaplar(isbn);
    if (fromKitaplar) {
      await writeCache(isbn, fromKitaplar);
      return fromKitaplar;
    }

    const fromOpenLibrary = await queryOpenLibrary(isbn);
    if (fromOpenLibrary) {
      await writeCache(isbn, fromOpenLibrary);
      return fromOpenLibrary;
    }

    await writeCache(isbn, null); // negative cache — don't re-query 30GB file
  }
  return null;
}

async function lookupSubjectsByIsbn(rawIsbn: string): Promise<string[]> {
  const record = await lookupEdition(rawIsbn);
  return record?.subjects || [];
}
