// @ajan: cursor · @etiket: katman-3, locale, parity, test
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function ftlIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

describe("locale FTL parity", () => {
  const localeRoot = join(process.cwd(), "addon", "locale");
  const enAddon = ftlIds(
    readFileSync(join(localeRoot, "en-US", "addon.ftl"), "utf8"),
  );
  const enPrefs = ftlIds(
    readFileSync(join(localeRoot, "en-US", "preferences.ftl"), "utf8"),
  );

  for (const loc of readdirSync(localeRoot)) {
    if (loc === "en-US") continue;
    it(`${loc} addon.ftl covers en-US IDs`, () => {
      const ids = ftlIds(
        readFileSync(join(localeRoot, loc, "addon.ftl"), "utf8"),
      );
      const missing = [...enAddon].filter((id) => !ids.has(id));
      expect(missing, missing.join(", ")).toEqual([]);
    });
    it(`${loc} preferences.ftl covers en-US IDs`, () => {
      const ids = ftlIds(
        readFileSync(join(localeRoot, loc, "preferences.ftl"), "utf8"),
      );
      const missing = [...enPrefs].filter((id) => !ids.has(id));
      expect(missing, missing.join(", ")).toEqual([]);
    });
  }
});
