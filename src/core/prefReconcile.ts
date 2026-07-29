// @ajan: claude · @etiket: f1, feature-registry, pref-reconcile, live-toggle
import { config } from "../../package.json";
import type { FeatureContext } from "./featureRegistry";
import { FeatureRegistry } from "./featureRegistry";

export { initPrefReconcile, shutdownPrefReconcile };

let symbols: symbol[] = [];

/**
 * Watch every registered feature's `prefKey` and apply the change live via
 * `FeatureRegistry.setEnabled()` instead of requiring a Zotero restart.
 * Only features that actually register persistent process-wide state (e.g.
 * `reading.flow`'s Zotero.Notifier observer) need this — features whose
 * menu actions already read the pref at click-time (inciteful, semantic,
 * markdb, docx.cited, safe import) are already effectively live and simply
 * see their `init`/`shutdown` re-run here as a harmless no-op-ish reseed.
 */
function initPrefReconcile(registry: FeatureRegistry, ctx: FeatureContext) {
  shutdownPrefReconcile();
  for (const def of registry.list()) {
    if (!def.prefKey) continue;
    const prefName = `${config.prefsPrefix}.${def.prefKey}`;
    const symbol = Zotero.Prefs.registerObserver(
      prefName,
      (value: unknown) => {
        const enabled =
          value === undefined ? (def.defaultEnabled ?? true) : !!value;
        void registry.setEnabled(def.id, enabled, ctx);
      },
      true,
    );
    symbols.push(symbol);
  }
}

function shutdownPrefReconcile() {
  for (const symbol of symbols) {
    Zotero.Prefs.unregisterObserver(symbol);
  }
  symbols = [];
}
