// @ajan: cursor · @etiket: f2, safe-import, dialog, menu
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import { isWindowAlive } from "../utils/window";
import { updateHint } from "../utils/hint";
import { defaultImportSelection } from "../utils/safeImportParse";
import {
  parseBibliographyFile,
  parseBibliographyText,
} from "../utils/safeImportTranslate";
import { enrichLibraryDuplicates } from "../utils/safeImportLibraryCheck";
import { importSelectedCandidates } from "../utils/safeImportApply";
import type { ImportPreviewRow } from "../utils/safeImportTypes";

export { openSafeImport, initSafeImportWindow, safeImportMenuChild };

const DIALOG_ID = `${config.addonRef}-safe-import`;
let previewRows: ImportPreviewRow[] = [];
let selectedIds = new Set<string>();

async function openSafeImport() {
  if (isWindowAlive(addon.data.safeImport?.window)) {
    addon.data.safeImport.window!.focus();
    return;
  }

  const mainWin = Zotero.getMainWindow();
  if (!mainWin) return;

  const url = `chrome://${config.addonRef}/content/safe-import.xhtml`;
  const features =
    "chrome,centerscreen,resizable,dialog=no,width=920,height=640";
  const win =
    (mainWin.openDialog(url, DIALOG_ID, features) as Window | null) ||
    (mainWin.open(url, DIALOG_ID, features) as Window | null);
  if (!win) return;

  addon.data.safeImport = { window: win };
  win.addEventListener("unload", () => {
    if (addon.data.safeImport?.window === win) {
      addon.data.safeImport.window = undefined;
    }
  });

  await waitForWindowLoad(win);
  await initSafeImportWindow(win);
}

function waitForWindowLoad(win: Window): Promise<void> {
  return new Promise((resolve) => {
    if (win.document.readyState === "complete") {
      resolve();
      return;
    }
    win.addEventListener("load", () => resolve(), { once: true });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function warningText(row: ImportPreviewRow): string {
  return row.warnings
    .map((w) => {
      switch (w.kind) {
        case "missing-title":
          return getString("safe-import-warn-missing-title");
        case "missing-identifier":
          return getString("safe-import-warn-missing-id");
        case "duplicate-batch":
          return getString("safe-import-warn-dup-batch");
        case "duplicate-library":
          return getString("safe-import-warn-dup-library", {
            args: { key: w.itemKey },
          });
      }
    })
    .join("; ");
}

function renderRows(doc: Document) {
  const tbody = doc.getElementById(`${config.addonRef}-safe-import-rows`);
  if (!tbody) return;
  tbody.innerHTML = "";
  for (const row of previewRows) {
    const tr = doc.createElement("tr");
    const blocked = row.warnings.some(
      (w) =>
        w.kind === "missing-title" ||
        w.kind === "duplicate-batch" ||
        w.kind === "duplicate-library",
    );
    const checked = selectedIds.has(row.rowId);
    tr.innerHTML = `
      <td><input type="checkbox" data-row-id="${escapeHtml(row.rowId)}" ${
        checked ? "checked" : ""
      } ${blocked ? "disabled" : ""} /></td>
      <td>${escapeHtml(row.title || "—")}</td>
      <td>${escapeHtml(row.authors || "—")}</td>
      <td>${row.year ?? "—"}</td>
      <td>${escapeHtml(row.identifier || "—")}</td>
      <td class="${blocked ? "bad" : row.warnings.length ? "warn" : ""}">${escapeHtml(
        warningText(row) || "—",
      )}</td>`;
    tbody.appendChild(tr);
  }
  const importBtn = doc.getElementById(
    `${config.addonRef}-safe-import-import`,
  ) as HTMLButtonElement | null;
  if (importBtn) {
    importBtn.disabled = selectedIds.size === 0;
  }
}

async function runParse(doc: Document, raw: string) {
  const status = doc.getElementById(`${config.addonRef}-safe-import-status`);
  if (status) status.textContent = getString("safe-import-parsing");
  previewRows = await parseBibliographyText(raw);
  previewRows = await enrichLibraryDuplicates(previewRows);
  selectedIds = defaultImportSelection(previewRows);
  renderRows(doc);
  if (status) {
    status.textContent = getString("safe-import-parsed", {
      args: { count: String(previewRows.length) },
    });
  }
}

async function initSafeImportWindow(win: Window) {
  const doc = win.document;
  previewRows = [];
  selectedIds = new Set();

  doc.getElementById(`${config.addonRef}-safe-import-title`)!.textContent =
    getString("safe-import-title");
  const hint = doc.getElementById(`${config.addonRef}-safe-import-hint`);
  if (hint) hint.textContent = getString("safe-import-hint");
  const textarea = doc.getElementById(
    `${config.addonRef}-safe-import-text`,
  ) as HTMLTextAreaElement | null;
  if (textarea) textarea.placeholder = getString("safe-import-placeholder");

  const fileBtn = doc.getElementById(`${config.addonRef}-safe-import-file`);
  fileBtn?.addEventListener("click", async () => {
    const path = await new ztoolkit.FilePicker(
      getString("safe-import-file-title"),
      "open",
      [
        ["BibTeX/RIS", "*.bib;*.ris;*.txt"],
        ["All", "*.*"],
      ],
      "import.bib",
      win,
      "text",
    ).open();
    if (!path) return;
    const status = doc.getElementById(`${config.addonRef}-safe-import-status`);
    if (status) status.textContent = getString("safe-import-parsing");
    previewRows = await parseBibliographyFile(path);
    previewRows = await enrichLibraryDuplicates(previewRows);
    selectedIds = defaultImportSelection(previewRows);
    renderRows(doc);
    if (status) {
      status.textContent = getString("safe-import-parsed", {
        args: { count: String(previewRows.length) },
      });
    }
  });

  doc
    .getElementById(`${config.addonRef}-safe-import-parse`)
    ?.addEventListener("click", async () => {
      await runParse(doc, textarea?.value || "");
    });

  doc
    .getElementById(`${config.addonRef}-safe-import-import`)
    ?.addEventListener("click", async () => {
      const picked = previewRows.filter((r) => selectedIds.has(r.rowId));
      if (!picked.length) return;
      const status = doc.getElementById(
        `${config.addonRef}-safe-import-status`,
      );
      if (status) status.textContent = getString("safe-import-importing");
      let importedIds: number[] = [];
      let skipped = 0;
      try {
        ({ importedIds, skipped } = await importSelectedCandidates(picked));
      } catch (e) {
        ztoolkit.log("Safe import failed", e);
        if (status) {
          status.textContent = getString("safe-import-error", {
            args: { message: e instanceof Error ? e.message : String(e) },
          });
        }
        return;
      }
      updateHint(
        getString("safe-import-done", {
          args: {
            imported: String(importedIds.length),
            skipped: String(skipped),
          },
        }),
      );
      if (status) {
        status.textContent = getString("safe-import-done", {
          args: {
            imported: String(importedIds.length),
            skipped: String(skipped),
          },
        });
      }
    });

  doc
    .getElementById(`${config.addonRef}-safe-import-select-all`)
    ?.addEventListener("change", (ev) => {
      const checked = (ev.target as HTMLInputElement).checked;
      selectedIds = new Set();
      if (checked) {
        for (const row of previewRows) {
          if (
            !row.warnings.some(
              (w) =>
                w.kind === "missing-title" ||
                w.kind === "duplicate-batch" ||
                w.kind === "duplicate-library",
            )
          ) {
            selectedIds.add(row.rowId);
          }
        }
      }
      renderRows(doc);
    });

  doc
    .getElementById(`${config.addonRef}-safe-import-rows`)
    ?.addEventListener("change", (ev) => {
      const target = ev.target as HTMLInputElement;
      if (target.type !== "checkbox" || !target.dataset.rowId) return;
      if (target.checked) selectedIds.add(target.dataset.rowId);
      else selectedIds.delete(target.dataset.rowId);
      const importBtn = doc.getElementById(
        `${config.addonRef}-safe-import-import`,
      ) as HTMLButtonElement | null;
      if (importBtn) importBtn.disabled = selectedIds.size === 0;
    });
}

function safeImportMenuChild() {
  return {
    tag: "menuitem" as const,
    label: getString("menu-safe-import"),
    commandListener: () => {
      if (getPref("import.enabled") === false) return;
      openSafeImport();
    },
  };
}
