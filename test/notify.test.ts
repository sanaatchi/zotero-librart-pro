// @ajan: claude · @etiket: katman-3, notify, notifier-await-fix, test
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("initNotifierObserver's notify callback", () => {
  it("returns/awaits onNotify's promise instead of calling it fire-and-forget", () => {
    // Regression: Zotero's own Notifier.trigger() wraps
    // `await Promise.resolve(ref.notify(...))` in try/catch — but that only
    // catches errors that happen BEFORE this callback's own returned
    // promise resolves. If `notify` calls onNotify() without returning (or
    // awaiting) it, the async function's promise resolves as soon as
    // onNotify is merely invoked, not when its real async work finishes —
    // any later rejection inside onNotify becomes an unhandled rejection
    // that Zotero's catch-all in notifier.js never sees (verified against
    // zotero/zotero's actual notifier.js source, which wraps exactly the
    // promise `ref.notify(...)` returns, nothing deeper).
    const source = readFileSync(
      join(__dirname, "../src/modules/notify.ts"),
      "utf8",
    );
    const start = source.indexOf("function initNotifierObserver");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf("\n  };", start);
    const callbackBody = source.slice(start, end);
    expect(callbackBody).toMatch(/return onNotify\(/);
    expect(callbackBody).not.toMatch(
      /(?<!return )onNotify\(event, type, ids, extraData\);\s*\n\s*\},/,
    );
  });
});
