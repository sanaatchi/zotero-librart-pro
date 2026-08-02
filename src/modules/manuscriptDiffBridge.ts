// @ajan: cursor · @etiket: manuscript-diff, docx-cited, makale-yazim, bridge
/** Manuscript cited vs collection unused report (builds on F3 DOCX cited). */

import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import { updateHint } from "../utils/hint";
import { getZoteroAdapter } from "../adapters/zoteroAdapter";
import {
  computeManuscriptDiff,
} from "../utils/manuscriptDiff";
import { isDocxCitedEnabled } from "./docxCitedBridge";

export {
  manuscriptDiffMenuChild,
  runManuscriptDiffReport,
  listDocxCitedTags,
};

const REGISTRY_PREF = "docxCited.registry";

function alertDialog(message: string) {
  ztoolkit.getGlobal("alert")(message);
}

function loadRegistry(): Record<string, string> {
  const raw = getPref(REGISTRY_PREF);
  if (!raw || typeof raw !== "string") return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function listDocxCitedTags(): string[] {
  const tags = new Set<string>();
  for (const tag of Object.values(loadRegistry())) {
    if (tag?.trim()) tags.add(tag.trim());
  }
  return [...tags].sort();
}

async function getTaggedItemIDs(
  tag: string,
  libraryID: number,
): Promise<number[]> {
  const s = new Zotero.Search({ libraryID }) as Zotero.Search;
  s.addCondition("tag", "is", tag);
  return s.search();
}

function collectScopeItemIds(): {
  ids: number[];
  label: string;
} | null {
  const pane = getZoteroAdapter().getActivePane();
  if (!pane) return null;

  const collection = pane.getSelectedCollection?.();
  if (collection) {
    const kids = collection.getChildItems?.(false) ?? [];
    const ids = kids.filter((i) => i.isRegularItem()).map((i) => i.id);
    return {
      ids,
      label: collection.name || getString("manuscript-diff-scope-collection"),
    };
  }

  const selected =
    pane.getSelectedItems()?.filter((i) => i.isRegularItem()) ?? [];
  if (selected.length >= 2) {
    return {
      ids: selected.map((i) => i.id),
      label: getString("manuscript-diff-scope-selection"),
    };
  }

  return null;
}

function pickTagInteractive(tags: string[]): string | null {
  if (!tags.length) return null;
  if (tags.length === 1) return tags[0];
  try {
    const Services = ztoolkit.getGlobal("Services") as {
      prompt: {
        select: (
          win: Window | null,
          title: string,
          message: string,
          list: string[],
          selected: { value: number },
        ) => boolean;
      };
    };
    const win = Zotero.getMainWindow();
    const selected = { value: 0 };
    const ok = Services.prompt.select(
      win,
      getString("manuscript-diff-title"),
      getString("manuscript-diff-pick-tag"),
      tags,
      selected,
    );
    if (!ok || selected.value < 0 || selected.value >= tags.length) return null;
    return tags[selected.value];
  } catch {
    return tags[0];
  }
}

async function selectItemsByIds(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const pane = getZoteroAdapter().getActivePane() as
    | (ReturnType<ReturnType<typeof getZoteroAdapter>["getActivePane"]> & {
        selectItems?: (ids: number[]) => void;
        selectItem?: (id: number) => void;
      })
    | null
    | undefined;
  try {
    if (pane?.selectItems) {
      pane.selectItems(ids);
      return;
    }
  } catch {
    /* soft */
  }
  try {
    pane?.selectItem?.(ids[0]);
  } catch {
    /* soft */
  }
}

async function runManuscriptDiffReport(): Promise<void> {
  if (!isDocxCitedEnabled()) {
    alertDialog(getString("manuscript-diff-docx-disabled"));
    return;
  }

  const tags = listDocxCitedTags();
  if (!tags.length) {
    alertDialog(getString("manuscript-diff-no-tags"));
    return;
  }

  const scope = collectScopeItemIds();
  if (!scope) {
    alertDialog(getString("manuscript-diff-no-scope"));
    return;
  }

  const tag = pickTagInteractive(tags);
  if (!tag) return;

  const libraryID =
    getZoteroAdapter().getActivePane()?.getSelectedItems()?.[0]?.libraryID ??
    Zotero.Libraries.userLibraryID;
  const citedIds = await getTaggedItemIDs(tag, libraryID);
  const result = computeManuscriptDiff({
    citedIds,
    scopeIds: scope.ids,
  });

  const summary = [
    getString("manuscript-diff-title") + `: ${tag}`,
    getString("manuscript-diff-line-cited", {
      args: {
        cited: result.citedCount,
        inScope: result.citedInScope.length,
      },
    }),
    getString("manuscript-diff-line-unused", {
      args: { unused: result.unusedInScope.length },
    }),
    getString("manuscript-diff-line-outside", {
      args: { outside: result.citedOutsideScope.length },
    }),
    getString("manuscript-diff-scope-label", {
      args: { scope: scope.label, count: scope.ids.length },
    }),
  ].join("\n");

  updateHint(summary);
  alertDialog(summary);

  if (result.unusedInScope.length) {
    await selectItemsByIds(result.unusedInScope.slice(0, 200));
  }
}

function manuscriptDiffMenuChild() {
  return {
    tag: "menuitem" as const,
    label: getString("menu-manuscript-diff"),
    commandListener: () => {
      void runManuscriptDiffReport();
    },
  };
}
