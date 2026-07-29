// @ajan: cursor · @etiket: f7, anki, yanki-connect, vendor
// Protocol shapes inspired by yanki-connect (MIT, Eric Mika) + AnkiConnect API v6.
// Thin helpers only — full YankiConnect class is not vendored (Node/fetch/autoLaunch).

export type AnkiLinkData = {
  v: 1;
  noteId: number;
  deck: string;
  model: string;
  updatedAt: number;
};

export type AnkiItemFields = {
  key: string;
  title: string;
  creators: string;
  year: string;
  abstractNote: string;
  doi: string;
};

export type BasicNoteFields = {
  Front: string;
  Back: string;
};

export const ANKI_EXTRA_PREFIX = "LibRart-Anki: ";
export const ANKI_TAG = "librart";
export const ITEM_KEY_TAG_PREFIX = "librart:itemKey=";

export { parseAnkiLink, writeAnkiLink, itemKeyTag, findNotesQuery, buildBasicFields, decideNoteId };

function parseAnkiLink(extra: string): AnkiLinkData | null {
  const line = (extra || "")
    .split("\n")
    .find((l) => l.startsWith(ANKI_EXTRA_PREFIX));
  if (!line) return null;
  try {
    const parsed = JSON.parse(line.slice(ANKI_EXTRA_PREFIX.length)) as Partial<AnkiLinkData>;
    if (
      parsed?.v === 1 &&
      typeof parsed.noteId === "number" &&
      Number.isFinite(parsed.noteId) &&
      parsed.noteId > 0
    ) {
      return {
        v: 1,
        noteId: parsed.noteId,
        deck: typeof parsed.deck === "string" ? parsed.deck : "",
        model: typeof parsed.model === "string" ? parsed.model : "",
        updatedAt:
          typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
            ? parsed.updatedAt
            : 0,
      };
    }
  } catch {
    /* ignore corrupt line */
  }
  return null;
}

function writeAnkiLink(extra: string, data: AnkiLinkData): string {
  const lines = (extra || "")
    .split("\n")
    .filter((l) => l.length > 0 && !l.startsWith(ANKI_EXTRA_PREFIX));
  lines.push(`${ANKI_EXTRA_PREFIX}${JSON.stringify(data)}`);
  return lines.join("\n");
}

function itemKeyTag(itemKey: string): string {
  return `${ITEM_KEY_TAG_PREFIX}${itemKey}`;
}

function findNotesQuery(itemKey: string): string {
  return `tag:${itemKeyTag(itemKey)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBasicFields(item: AnkiItemFields): BasicNoteFields {
  const title = item.title.trim() || "(untitled)";
  const meta: string[] = [];
  if (item.creators.trim()) meta.push(escapeHtml(item.creators.trim()));
  if (item.year.trim()) meta.push(escapeHtml(item.year.trim()));
  const abstract = item.abstractNote.trim().slice(0, 1200);
  const backParts = [
    meta.length ? `<p><b>${meta.join(" · ")}</b></p>` : "",
    abstract ? `<p>${escapeHtml(abstract)}</p>` : "",
    item.doi.trim()
      ? `<p>DOI: ${escapeHtml(item.doi.trim())}</p>`
      : "",
    `<p><code>zotero:${escapeHtml(item.key)}</code></p>`,
  ].filter(Boolean);
  return {
    Front: escapeHtml(title),
    Back: backParts.join("\n") || escapeHtml(title),
  };
}

/** Prefer Extra noteId; else first findNotes hit; else null → add. */
function decideNoteId(
  linkedNoteId: number | null | undefined,
  foundIds: number[],
): number | null {
  if (
    typeof linkedNoteId === "number" &&
    Number.isFinite(linkedNoteId) &&
    linkedNoteId > 0
  ) {
    return linkedNoteId;
  }
  const first = foundIds.find(
    (id) => typeof id === "number" && Number.isFinite(id) && id > 0,
  );
  return first ?? null;
}
