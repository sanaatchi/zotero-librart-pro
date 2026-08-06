// @ajan: claude · @etiket: katman-3, notify, notifier-await-fix, test, behavioral-proof
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Heavy real dependency (IOUtils/embedding pipeline) — replaced with a
// controllable fake so this test can assert on timing/rejection without
// touching disk or a real vector store.
const removeItemEmbeddingMock = vi.fn();
vi.mock("../src/vendor/zotseek/vectorStoreRuntime", () => ({
  removeItemEmbedding: (...args: unknown[]) => removeItemEmbeddingMock(...args),
}));

describe("notify.ts callback — behavioral proof the return-onNotify fix actually chains", () => {
  let capturedCallback: { notify: (...args: any[]) => Promise<void> } | null;

  beforeEach(() => {
    vi.resetModules();
    capturedCallback = null;
    removeItemEmbeddingMock.mockReset();
    (globalThis as any).addon = { data: { alive: true } };
    (globalThis as any).ztoolkit = { log: () => {} };
    (globalThis as any).Zotero = {
      Notifier: {
        registerObserver: (ref: { notify: (...args: any[]) => Promise<void> }) => {
          capturedCallback = ref;
          return "observer-id";
        },
        unregisterObserver: () => {},
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).addon;
    delete (globalThis as any).ztoolkit;
    delete (globalThis as any).Zotero;
  });

  it("notify()'s returned promise does NOT resolve until onNotify's real async work (removeItemEmbedding) finishes", async () => {
    // This is the exact bug the fix addresses: without `return`, Zotero's
    // `await Promise.resolve(ref.notify(...))` (see zotero/zotero's real
    // notifier.js) would resolve as soon as onNotify is merely *invoked*,
    // not when its awaited work completes.
    let resolveEmbeddingRemoval: () => void;
    removeItemEmbeddingMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveEmbeddingRemoval = () => resolve(true);
        }),
    );

    const { initNotifierObserver } = await import("../src/modules/notify");
    initNotifierObserver();
    expect(capturedCallback).not.toBeNull();

    let notifyResolved = false;
    const notifyPromise = capturedCallback!
      .notify("trash", "item", [123], {})
      .then(() => {
        notifyResolved = true;
      });

    // Let any already-queued microtasks flush. If the bug were present,
    // notifyResolved would already be true here — before the mocked
    // removeItemEmbedding's promise has been resolved at all.
    await Promise.resolve();
    await Promise.resolve();
    expect(notifyResolved).toBe(false);
    expect(removeItemEmbeddingMock).toHaveBeenCalledWith(123);

    resolveEmbeddingRemoval!();
    await notifyPromise;
    expect(notifyResolved).toBe(true);
  });

  it("a rejection inside onNotify's async work propagates out through notify()'s returned promise", async () => {
    // Proves the chain is real, not just a shape-match: Zotero's own
    // try/catch around `await Promise.resolve(ref.notify(...))` can only
    // catch this if the rejection actually surfaces on the promise IT
    // awaits — which requires the `return` this fix added.
    removeItemEmbeddingMock.mockRejectedValue(new Error("boom"));

    const { initNotifierObserver } = await import("../src/modules/notify");
    initNotifierObserver();
    expect(capturedCallback).not.toBeNull();

    await expect(
      capturedCallback!.notify("delete", "item", [456], {}),
    ).rejects.toThrow("boom");
  });
});
