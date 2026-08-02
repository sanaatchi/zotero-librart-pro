// @ajan: cursor · @etiket: features, g1-citation-bridge-removed
import { FeatureRegistry } from "./featureRegistry";
import { ActionEventTypes, initActions } from "../utils/actions";
import { getPref, setPref } from "../utils/prefs";
import { initNotifierObserver } from "../modules/notify";
import { initShortcuts } from "../modules/shortcuts";
import {
  initItemMenu,
  initReaderAnnotationMenu,
  initReaderMenu,
} from "../modules/menu";
import { registerRatingColumn } from "../utils/rating";
import { initReferenceReader } from "../modules/referenceReader";
import {
  initNoteWorkspace,
  ensureNoteWorkspacePrefDefaults,
} from "../modules/noteWorkspace";
import { initIncitefulMenus } from "../modules/incitefulBridge";
import {
  initReadingFlow,
  shutdownReadingFlow,
} from "../modules/readingFlowBridge";
import { ensureAnkiPrefDefaults } from "../modules/ankiBridge";
import { ensureMarkdbPrefDefaults } from "../modules/markdbBridge";
import { ensureSemanticPrefDefaults } from "../modules/semanticBridge";
import { ensureCitegeistPrefDefaults } from "../modules/citegeistBridge";
import { ensureRefcheckerPrefDefaults } from "../modules/refcheckerBridge";

export { registerLibRartFeatures };

function registerLibRartFeatures(registry: FeatureRegistry): void {
  registry.register({
    id: "core.bootstrap",
    phase: "startup",
    init: () => {
      if (getPref("inciteful.enabled") === undefined) {
        setPref("inciteful.enabled", true);
      }
    },
  });

  registry.register({
    id: "core.actions",
    phase: "startup",
    init: () => {
      initActions();
      initNotifierObserver();
      initShortcuts();
    },
  });

  registry.register({
    id: "menu.reader",
    phase: "startup",
    init: async () => {
      await initReaderMenu();
      initReaderAnnotationMenu();
    },
  });

  registry.register({
    id: "rating",
    phase: "startup",
    init: () => registerRatingColumn(),
  });

  registry.register({
    id: "menu.item",
    phase: "mainWindow",
    init: (_ctx, win) => {
      if (win) initItemMenu(win);
    },
  });

  registry.register({
    id: "docx.cited",
    phase: "mainWindow",
    prefKey: "docxCited.enabled",
    defaultEnabled: true,
    init: () => {
      if (getPref("docxCited.enabled") === undefined) {
        setPref("docxCited.enabled", true);
      }
    },
  });

  registry.register({
    id: "import.safe",
    phase: "mainWindow",
    prefKey: "import.enabled",
    defaultEnabled: true,
    init: () => {
      if (getPref("import.enabled") === undefined) {
        setPref("import.enabled", true);
      }
    },
  });

  registry.register({
    id: "reading.flow",
    // Process-wide state (Zotero.Notifier observer, ItemTreeManager columns,
    // reading-flow store) — none of this is per-window. Must be "startup",
    // not "mainWindow", or every new window re-registers a duplicate global
    // observer/columns and overwrites the tracker reference of prior windows.
    phase: "startup",
    prefKey: "reading.enabled",
    defaultEnabled: true,
    init: () => {
      if (getPref("reading.enabled") === undefined) {
        setPref("reading.enabled", true);
      }
      initReadingFlow();
    },
    shutdown: () => shutdownReadingFlow(),
  });

  registry.register({
    id: "citation.openalex",
    phase: "startup",
    prefKey: "citation.layers.openalex",
    defaultEnabled: true,
    init: () => {
      if (getPref("citation.layers.crossref") === undefined) {
        setPref("citation.layers.crossref", true);
      }
      if (getPref("citation.layers.openalex") === undefined) {
        setPref("citation.layers.openalex", true);
      }
      if (getPref("citation.layers.openCitations") === undefined) {
        setPref("citation.layers.openCitations", false);
      }
      if (getPref("openalex.mailto") === undefined) {
        setPref("openalex.mailto", "");
      }
      if (getPref("openalex.cacheDays") === undefined) {
        setPref("openalex.cacheDays", 30);
      }
    },
  });

  registry.register({
    id: "inciteful",
    phase: "mainWindow",
    prefKey: "inciteful.enabled",
    defaultEnabled: true,
    init: () => initIncitefulMenus(),
  });

  registry.register({
    id: "anki.bridge",
    phase: "startup",
    init: () => {
      // Pref gate is runtime (menu click); defaults always seeded.
      ensureAnkiPrefDefaults();
    },
  });

  registry.register({
    id: "note.markdb",
    phase: "startup",
    init: () => {
      ensureMarkdbPrefDefaults();
    },
  });

  registry.register({
    id: "semantic.kutuphane",
    phase: "startup",
    init: () => {
      ensureSemanticPrefDefaults();
    },
  });

  registry.register({
    id: "reference.reader",
    phase: "mainWindow",
    init: async () => initReferenceReader(),
  });

  registry.register({
    id: "note.workspace",
    phase: "startup",
    init: () => {
      ensureNoteWorkspacePrefDefaults();
    },
  });

  registry.register({
    id: "citegeist.summary",
    phase: "startup",
    init: () => {
      ensureCitegeistPrefDefaults();
    },
  });

  registry.register({
    id: "refchecker.bridge",
    phase: "startup",
    init: () => {
      ensureRefcheckerPrefDefaults();
    },
  });

  registry.register({
    id: "note.workspace.init",
    phase: "mainWindow",
    init: async () => initNoteWorkspace(),
  });

  registry.register({
    id: "core.startupActions",
    phase: "mainWindow",
    init: async (ctx, win) => {
      await addon.api.actionManager.dispatchActionByEvent(
        ActionEventTypes.mainWindowLoad,
        { window: win },
      );
    },
  });
}
