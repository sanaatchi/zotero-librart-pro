// @ajan: cursor · @etiket: f9.2.3, zotseek, write-queue
// Pure serial write queue — no Zotero globals.

export { createSerialQueue };

function createSerialQueue(): <T>(fn: () => Promise<T>) => Promise<T> {
  let chain: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
