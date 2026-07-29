// @ajan: cursor · @etiket: f9.2.3, vitest, serial-queue
import { describe, expect, it } from "vitest";
import { createSerialQueue } from "../src/vendor/zotseek/serialQueue";

describe("createSerialQueue", () => {
  it("runs tasks in order even when started together", async () => {
    const enqueue = createSerialQueue();
    const order: number[] = [];
    const tasks = [1, 2, 3].map((n) =>
      enqueue(async () => {
        await new Promise((r) => setTimeout(r, 5 - n));
        order.push(n);
        return n;
      }),
    );
    await Promise.all(tasks);
    expect(order).toEqual([1, 2, 3]);
  });

  it("continues after a rejected task", async () => {
    const enqueue = createSerialQueue();
    const order: string[] = [];
    await enqueue(async () => {
      order.push("a");
    });
    await enqueue(async () => {
      order.push("b");
      throw new Error("boom");
    }).catch(() => undefined);
    await enqueue(async () => {
      order.push("c");
    });
    expect(order).toEqual(["a", "b", "c"]);
  });
});
