// @ajan: cursor · @etiket: f1, feature-registry, multi-window, core
import type { ZoteroAdapter } from "../adapters/zoteroAdapter";

export type FeaturePhase = "startup" | "mainWindow";

export type FeatureContext = {
  adapter: ZoteroAdapter;
};

export type FeatureDefinition = {
  id: string;
  phase: FeaturePhase;
  /** Pref suffix under `extensions.librartPro.*`; omit = once always on. */
  prefKey?: string;
  defaultEnabled?: boolean;
  init: (ctx: FeatureContext, win?: Window) => void | Promise<void>;
  /** Process-wide teardown (plugin shutdown). */
  shutdown?: () => void;
  /** Per-window teardown when a Zotero window closes. */
  shutdownWindow?: (win: Window) => void;
};

export type PrefReader = (key: string) => unknown;

export { FeatureRegistry, getFeatureRegistry, resetFeatureRegistry };

class FeatureRegistry {
  private readonly features = new Map<string, FeatureDefinition>();
  /** startup phase — once per process */
  private readonly startupInitialized = new Set<string>();
  /** mainWindow phase — once per window */
  private readonly windowInitialized = new Map<Window, Set<string>>();
  /** Features that ran at least once (for process shutdown order). */
  private readonly everInitialized: string[] = [];

  register(definition: FeatureDefinition): void {
    if (this.features.has(definition.id)) {
      throw new Error(`Feature already registered: ${definition.id}`);
    }
    this.features.set(definition.id, definition);
  }

  list(): FeatureDefinition[] {
    return [...this.features.values()];
  }

  isEnabled(definition: FeatureDefinition, readPref: PrefReader): boolean {
    if (!definition.prefKey) return true;
    const value = readPref(definition.prefKey);
    if (value === undefined) return definition.defaultEnabled ?? true;
    return !!value;
  }

  enabledFeatures(
    phase: FeaturePhase,
    readPref: PrefReader,
  ): FeatureDefinition[] {
    return this.list().filter(
      (def) => def.phase === phase && this.isEnabled(def, readPref),
    );
  }

  isInitialized(id: string, win?: Window): boolean {
    const def = this.features.get(id);
    if (!def) return false;
    if (def.phase === "startup") return this.startupInitialized.has(id);
    if (!win) return false;
    return this.windowInitialized.get(win)?.has(id) ?? false;
  }

  async initPhase(
    phase: FeaturePhase,
    ctx: FeatureContext,
    readPref: PrefReader,
    win?: Window,
  ): Promise<void> {
    if (phase === "mainWindow") {
      if (!win) return;
      let done = this.windowInitialized.get(win);
      if (!done) {
        done = new Set();
        this.windowInitialized.set(win, done);
      }
      for (const def of this.enabledFeatures(phase, readPref)) {
        if (done.has(def.id)) continue;
        await def.init(ctx, win);
        done.add(def.id);
        this.everInitialized.push(def.id);
      }
      return;
    }

    for (const def of this.enabledFeatures(phase, readPref)) {
      if (this.startupInitialized.has(def.id)) continue;
      await def.init(ctx, win);
      this.startupInitialized.add(def.id);
      this.everInitialized.push(def.id);
    }
  }

  /**
   * Live pref toggle — apply an enabled/disabled transition to a feature
   * without waiting for a Zotero restart. No-op if the feature is already
   * in the requested state. For `mainWindow`-phase features this applies to
   * every window this registry currently knows about.
   */
  async setEnabled(
    id: string,
    enabled: boolean,
    ctx: FeatureContext,
  ): Promise<void> {
    const def = this.features.get(id);
    if (!def) return;

    if (def.phase === "startup") {
      const active = this.startupInitialized.has(id);
      if (enabled === active) return;
      if (enabled) {
        await def.init(ctx);
        this.startupInitialized.add(id);
        this.everInitialized.push(id);
      } else {
        def.shutdown?.();
        this.startupInitialized.delete(id);
      }
      return;
    }

    for (const [win, done] of this.windowInitialized) {
      const active = done.has(id);
      if (enabled === active) continue;
      if (enabled) {
        await def.init(ctx, win);
        done.add(id);
        this.everInitialized.push(id);
      } else {
        def.shutdownWindow?.(win);
        done.delete(id);
      }
    }
  }

  /**
   * Tear down mainWindow features for one Zotero window.
   * Does not run process-wide `shutdown` (other windows may still be open).
   */
  unloadWindow(win: Window): void {
    const done = this.windowInitialized.get(win);
    if (!done) return;
    for (const id of [...done].reverse()) {
      this.features.get(id)?.shutdownWindow?.(win);
    }
    this.windowInitialized.delete(win);
  }

  shutdownAll(): void {
    for (const win of [...this.windowInitialized.keys()]) {
      this.unloadWindow(win);
    }
    const seen = new Set<string>();
    for (const id of [...this.everInitialized].reverse()) {
      if (seen.has(id)) continue;
      seen.add(id);
      this.features.get(id)?.shutdown?.();
    }
    this.startupInitialized.clear();
    this.everInitialized.length = 0;
  }
}

let registryInstance: FeatureRegistry | null = null;

function getFeatureRegistry(): FeatureRegistry {
  if (!registryInstance) {
    registryInstance = new FeatureRegistry();
  }
  return registryInstance;
}

function resetFeatureRegistry(): void {
  registryInstance = null;
}
