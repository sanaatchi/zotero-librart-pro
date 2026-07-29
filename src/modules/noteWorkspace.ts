// Adapted from zotero-better-notes (AGPL-3.0) — note workspace integration (staged).

import { config } from "../../package.json";

export { initNoteWorkspace, isNoteWorkspaceEnabled };

/**
 * Better Notes workspace/editor port — vendored under src/vendor/zotero-better-notes/.
 * Full custom-element registration requires additional BN assets (CSS, outlinePane,
 * contextPane, editor plugins). This hook wires the feature flag and defers heavy
 * init until those assets are bundled.
 */
function isNoteWorkspaceEnabled(): boolean {
  return Zotero.Prefs.get(`${config.prefsPrefix}.noteWorkspace`, true) !== false;
}

async function initNoteWorkspace(): Promise<void> {
  if (!isNoteWorkspaceEnabled()) return;
  ztoolkit.log(
    "Note workspace: vendored better-notes sources present; full UI registration pending asset bundle.",
  );
}
