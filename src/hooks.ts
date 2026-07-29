// @ajan: cursor · @etiket: f1, hooks, feature-registry, multi-window, startup-isolation
import { config, homepage } from "../package.json";
import { getString, initLocale } from "./utils/locale";
import { initPrefPane } from "./modules/preferenceWindow";
import { ActionEventTypes } from "./utils/actions";
import { getPref } from "./utils/prefs";
import {
  buildItemMenu,
  initItemMenu,
  initReaderAnnotationMenu,
  initReaderMenu,
} from "./modules/menu";
import { exportToFile, importFromFile } from "./modules/backup";
import {
  initTagDashboardWindow,
  openTagDashboard,
} from "./modules/tagDashboard";
import {
  initConnectionMapWindow,
  openConnectionMap,
} from "./modules/connectionMap";
import {
  initReadingDashboardWindow,
  openReadingDashboard,
} from "./modules/readingFlowBridge";
import { editAction } from "./modules/edit";
import { getZoteroAdapter } from "./adapters/zoteroAdapter";
import { getFeatureRegistry } from "./core/featureRegistry";
import { registerLibRartFeatures } from "./core/features";

let featuresRegistered = false;

function ensureFeaturesRegistered() {
  if (featuresRegistered) return;
  registerLibRartFeatures(getFeatureRegistry());
  featuresRegistered = true;
}

async function onStartup() {
  ensureFeaturesRegistered();

  const adapter = getZoteroAdapter();
  await adapter.waitForReady();

  if (__env__ === "development") {
    const loadDevToolWhen = `Plugin ${config.addonID} startup`;
    ztoolkit.log(loadDevToolWhen);
  }

  initLocale();

  const registry = getFeatureRegistry();
  const ctx = { adapter };
  await registry.initPhase("startup", ctx, getPref);

  Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    helpURL: homepage,
    image: rootURI + "content/icons/favicon.png",
  });

  addon.api.actionManager
    .dispatchActionByEvent(ActionEventTypes.programStartup, {})
    .catch((err) => {
      ztoolkit.log("programStartup action failed (window init continues)", err);
    });
  // Window features must not depend on user startup actions succeeding.
  await onMainWindowLoad(window);
}

async function onMainWindowLoad(win: Window): Promise<void> {
  const registry = getFeatureRegistry();
  const ctx = { adapter: getZoteroAdapter() };
  await registry.initPhase("mainWindow", ctx, getPref, win);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  getFeatureRegistry().unloadWindow(win);
  await addon.api.actionManager.dispatchActionByEvent(
    ActionEventTypes.mainWindowUnload,
    { window: win },
  );
}

function onShutdown(): void {
  getFeatureRegistry().shutdownAll();
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  // @ts-ignore - plugin instance
  delete Zotero[config.addonInstance];
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      initPrefPane(data.window);
      break;
    default:
      return;
  }
}

async function onMenuEvent(type: "showing", data: { [key: string]: any }) {
  switch (type) {
    case "showing":
      buildItemMenu(data.window, data.target, data.extraData);
      break;
    default:
      return;
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
  onMenuEvent,
  onActionEdit: editAction,
  onActionExport: exportToFile,
  onActionImport: importFromFile,
  onOpenTagDashboard: openTagDashboard,
  onTagDashboardLoad: initTagDashboardWindow,
  onOpenConnectionMap: openConnectionMap,
  onConnectionMapLoad: initConnectionMapWindow,
  onOpenReadingDashboard: openReadingDashboard,
  onReadingDashboardLoad: initReadingDashboardWindow,
};
