// @ajan: cursor · @etiket: f1, vitest, feature-registry
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
    await registry.initPhase(
      "startup",
      { adapter: mockAdapter },
      (key) => (key === "inciteful.enabled" ? false : undefined),
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
    await registry.initPhase("startup", { adapter: mockAdapter }, () => undefined);
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
});
