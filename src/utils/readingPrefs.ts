// @ajan: cursor · @etiket: katman-3, reading-prefs, opt-out
import { getPref, setPref } from "./prefs";

export { ensureReadingDisabledByDefault };

/** One-shot: reading was on-by-default and wrote Extra; force off once. */
function ensureReadingDisabledByDefault(): void {
  if (getPref("reading.disabledDefaultMigrated") === true) {
    if (getPref("reading.enabled") === undefined) {
      setPref("reading.enabled", false);
    }
    return;
  }
  setPref("reading.enabled", false);
  setPref("reading.disabledDefaultMigrated", true);
}
