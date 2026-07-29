// @ajan: cursor · @etiket: f8.2, better-notes, vendor, note-html
// Thin note HTML append — inspired by zotero-better-notes addLineToNote (AGPL-3.0),
// without editor/plugins dependency (metadata-only insert).

export { appendHtmlToNoteContent };

const SCHEMA_WRAPPER_RE = /data-schema-version="[^"]*"/i;

function appendHtmlToNoteContent(existingHtml: string, html: string): string {
  const chunk = (html || "").trim();
  if (!chunk) return existingHtml || "";

  const note = existingHtml || "";
  if (!note.trim()) {
    return `<div data-schema-version="9">${chunk}</div>`;
  }

  const closeIdx = note.toLowerCase().lastIndexOf("</div>");
  if (SCHEMA_WRAPPER_RE.test(note) && closeIdx >= 0) {
    return `${note.slice(0, closeIdx)}${chunk}${note.slice(closeIdx)}`;
  }
  return `${note}\n${chunk}`;
}
