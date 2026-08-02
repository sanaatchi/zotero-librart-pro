// @ajan: cursor · @etiket: katman-3, tests, reading-off-default
import { beforeEach, describe, expect, it, vi } from "vitest";

const prefs = new Map<string, unknown>();

vi.mock("../src/utils/prefs", () => ({
  getPref: (key: string) => prefs.get(key),
  setPref: (key: string, value: unknown) => {
    prefs.set(key, value);
  },
}));

describe("ensureReadingDisabledByDefault", () => {
  beforeEach(() => {
    prefs.clear();
    vi.resetModules();
  });

  it("forces reading.enabled false once and sets migrate flag", async () => {
    prefs.set("reading.enabled", true);
    const { ensureReadingDisabledByDefault } = await import(
      "../src/utils/readingPrefs"
    );
    ensureReadingDisabledByDefault();
    expect(prefs.get("reading.enabled")).toBe(false);
    expect(prefs.get("reading.disabledDefaultMigrated")).toBe(true);
  });

  it("does not override user re-enable after migrate", async () => {
    prefs.set("reading.disabledDefaultMigrated", true);
    prefs.set("reading.enabled", true);
    const { ensureReadingDisabledByDefault } = await import(
      "../src/utils/readingPrefs"
    );
    ensureReadingDisabledByDefault();
    expect(prefs.get("reading.enabled")).toBe(true);
  });
});
