// @ajan: cursor · @etiket: f1, vitest, feature-registry, multi-window
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FeatureRegistry,
  resetFeatureRegistry,
} from "../src/core/featureRegistry";
import type { ZoteroAdapter } from "../src/adapters/zoteroAdapter";

const mockAdapter = {} as ZoteroAdapter;

afterEach(() => {
  resetFeatureRegistry();
});

describe("FeatureRegistry", () => {
  it("registers features in insertion order", () => {
    const registry = new FeatureRegistry();
    const order: string[] = [];
    registry.register({
      id: "a",
      phase: "startup",
      init: () => {
        order.push("a");
      },
    });
    registry.register({
      id: "b",
      phase: "startup",
      init: () => {
        order.push("b");
      },
    });
    return registry
      .initPhase("startup", { adapter: mockAdapter }, () => undefined)
      .then(() => {
        expect(order).toEqual(["a", "b"]);
      });
  });

  it("skips disabled pref-gated features", async () => {
    const registry = new FeatureRegistry();
    const ran: string[] = [];
    registry.register({
      id: "on",
      phase: "startup",
      init: () => {
        ran.push("on");
      },
    });
    registry.register({
      id: "off",
      phase: "startup",
      prefKey: "inciteful.enabled",
      defaultEnabled: true,
      init: () => {
        ran.push("off");
      },
    });
    await registry.initPhase("startup", { adapter: mockAdapter }, (key) =>
      key === "inciteful.enabled" ? false : undefined,
    );
    expect(ran).toEqual(["on"]);
  });

  it("calls shutdown in reverse init order", async () => {
    const registry = new FeatureRegistry();
    const shutdown: string[] = [];
    registry.register({
      id: "first",
      phase: "startup",
      init: () => {},
      shutdown: () => shutdown.push("first"),
    });
    registry.register({
      id: "second",
      phase: "startup",
      init: () => {},
      shutdown: () => shutdown.push("second"),
    });
    await registry.initPhase(
      "startup",
      { adapter: mockAdapter },
      () => undefined,
    );
    registry.shutdownAll();
    expect(shutdown).toEqual(["second", "first"]);
  });

  it("rejects duplicate feature ids", () => {
    const registry = new FeatureRegistry();
    registry.register({ id: "x", phase: "startup", init: vi.fn() });
    expect(() =>
      registry.register({ id: "x", phase: "startup", init: vi.fn() }),
    ).toThrow(/already registered/);
  });

  it("inits mainWindow features once per window", async () => {
    const registry = new FeatureRegistry();
    const wins: Window[] = [];
    registry.register({
      id: "menu.item",
      phase: "mainWindow",
      init: (_ctx, win) => {
        wins.push(win as Window);
      },
    });
    const w1 = { id: 1 } as unknown as Window;
    const w2 = { id: 2 } as unknown as Window;
    await registry.initPhase(
      "mainWindow",
      { adapter: mockAdapter },
      () => undefined,
      w1,
    );
    await registry.initPhase(
      "mainWindow",
      { adapter: mockAdapter },
      () => undefined,
      w1,
    );
    await registry.initPhase(
      "mainWindow",
      { adapter: mockAdapter },
      () => undefined,
      w2,
    );
    expect(wins).toEqual([w1, w2]);
    expect(registry.isInitialized("menu.item", w1)).toBe(true);
    expect(registry.isInitialized("menu.item", w2)).toBe(true);
  });

  it("unloadWindow runs shutdownWindow without process shutdown", async () => {
    const registry = new FeatureRegistry();
    const windowShutdown: Window[] = [];
    const processShutdown: string[] = [];
    registry.register({
      id: "menu.item",
      phase: "mainWindow",
      init: () => {},
      shutdownWindow: (win) => windowShutdown.push(win),
      shutdown: () => processShutdown.push("menu.item"),
    });
    const w1 = { id: 1 } as unknown as Window;
    await registry.initPhase(
      "mainWindow",
      { adapter: mockAdapter },
      () => undefined,
      w1,
    );
    registry.unloadWindow(w1);
    expect(windowShutdown).toEqual([w1]);
    expect(processShutdown).toEqual([]);
    expect(registry.isInitialized("menu.item", w1)).toBe(false);

    await registry.initPhase(
      "mainWindow",
      { adapter: mockAdapter },
      () => undefined,
      w1,
    );
    registry.shutdownAll();
    expect(processShutdown).toEqual(["menu.item"]);
  });

  it("inits a startup-phase feature only once even if initPhase('startup') runs again (e.g. a second window's load sequence re-triggers plugin startup wiring)", async () => {
    const registry = new FeatureRegistry();
    const runs: number[] = [];
    let n = 0;
    registry.register({
      id: "reading.flow",
      phase: "startup",
      init: () => {
        runs.push(++n);
      },
    });
    await registry.initPhase(
      "startup",
      { adapter: mockAdapter },
      () => undefined,
    );
    await registry.initPhase(
      "startup",
      { adapter: mockAdapter },
      () => undefined,
    );
    expect(runs).toEqual([1]);
  });

  it("skips mainWindow init when window is missing", async () => {
    const registry = new FeatureRegistry();
    const init = vi.fn();
    registry.register({
      id: "menu.item",
      phase: "mainWindow",
      init,
    });
    await registry.initPhase(
      "mainWindow",
      { adapter: mockAdapter },
      () => undefined,
    );
    expect(init).not.toHaveBeenCalled();
  });

  describe("setEnabled (live pref toggle, no restart)", () => {
    it("startup feature: shuts down when disabled, re-inits when re-enabled", async () => {
      const registry = new FeatureRegistry();
      const events: string[] = [];
      registry.register({
        id: "reading.flow",
        phase: "startup",
        init: () => {
          events.push("init");
        },
        shutdown: () => {
          events.push("shutdown");
        },
      });
      await registry.initPhase(
        "startup",
        { adapter: mockAdapter },
        () => undefined,
      );
      expect(events).toEqual(["init"]);

      await registry.setEnabled("reading.flow", false, {
        adapter: mockAdapter,
      });
      expect(events).toEqual(["init", "shutdown"]);

      await registry.setEnabled("reading.flow", true, { adapter: mockAdapter });
      expect(events).toEqual(["init", "shutdown", "init"]);
    });

    it("startup feature: setEnabled is a no-op when already in the requested state", async () => {
      const registry = new FeatureRegistry();
      const init = vi.fn();
      const shutdown = vi.fn();
      registry.register({ id: "x", phase: "startup", init, shutdown });
      await registry.initPhase(
        "startup",
        { adapter: mockAdapter },
        () => undefined,
      );
      init.mockClear();

      await registry.setEnabled("x", true, { adapter: mockAdapter });
      expect(init).not.toHaveBeenCalled();
      expect(shutdown).not.toHaveBeenCalled();
    });

    it("mainWindow feature: disabling tears down every currently-open window, re-enabling re-inits them", async () => {
      const registry = new FeatureRegistry();
      const initedFor: Window[] = [];
      const shutdownFor: Window[] = [];
      registry.register({
        id: "docx.cited",
        phase: "mainWindow",
        init: (_ctx, win) => {
          initedFor.push(win as Window);
        },
        shutdownWindow: (win) => {
          shutdownFor.push(win);
        },
      });
      const w1 = { id: 1 } as unknown as Window;
      const w2 = { id: 2 } as unknown as Window;
      await registry.initPhase(
        "mainWindow",
        { adapter: mockAdapter },
        () => undefined,
        w1,
      );
      await registry.initPhase(
        "mainWindow",
        { adapter: mockAdapter },
        () => undefined,
        w2,
      );
      expect(initedFor).toEqual([w1, w2]);

      await registry.setEnabled("docx.cited", false, { adapter: mockAdapter });
      expect(shutdownFor).toEqual([w1, w2]);
      expect(registry.isInitialized("docx.cited", w1)).toBe(false);
      expect(registry.isInitialized("docx.cited", w2)).toBe(false);

      await registry.setEnabled("docx.cited", true, { adapter: mockAdapter });
      expect(initedFor).toEqual([w1, w2, w1, w2]);
    });

    it("unknown feature id is a silent no-op", async () => {
      const registry = new FeatureRegistry();
      await expect(
        registry.setEnabled("nope", true, { adapter: mockAdapter }),
      ).resolves.toBeUndefined();
    });
  });
});
