// @ajan: cursor · @etiket: katman-3, startup-order, test
import { describe, expect, it, vi } from "vitest";
import { runProgramStartupThenMainWindow } from "../src/utils/startupOrder";

describe("runProgramStartupThenMainWindow", () => {
  it("awaits successful dispatch before main-window init", async () => {
    const order: string[] = [];
    await runProgramStartupThenMainWindow(
      async () => {
        order.push("dispatch-start");
        await Promise.resolve();
        order.push("dispatch-end");
      },
      async () => {
        order.push("main-window-init");
      },
      () => {
        order.push("error");
      },
    );
    expect(order).toEqual([
      "dispatch-start",
      "dispatch-end",
      "main-window-init",
    ]);
  });

  it("still inits main window after dispatch rejection", async () => {
    const order: string[] = [];
    const onError = vi.fn();
    await runProgramStartupThenMainWindow(
      async () => {
        order.push("dispatch-start");
        throw new Error("boom");
      },
      async () => {
        order.push("main-window-init");
      },
      onError,
    );
    expect(order).toEqual(["dispatch-start", "main-window-init"]);
    expect(onError).toHaveBeenCalledOnce();
  });
});
