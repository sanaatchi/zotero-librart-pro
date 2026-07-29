// @ajan: cursor · @etiket: f1, feature-registry, core
import type { ZoteroAdapter } from "../adapters/zoteroAdapter";

export type FeaturePhase = "startup" | "mainWindow";

export type FeatureContext = {
  adapter: ZoteroAdapter;
};

export type FeatureDefinition = {
  id: string;
  phase: FeaturePhase;
  /** Pref suffix under `extensions.librartPro.*`; omit = always on. */
  prefKey?: string;
  defaultEnabled?: boolean;
  init: (ctx: FeatureContext, win?: Window) => void | Promise<void>;
  shutdown?: () => void;
};

export type PrefReader = (key: string) => unknown;

export { FeatureRegistry, getFeatureRegistry, resetFeatureRegistry };

class FeatureRegistry {
  private readonly features = new Map<string, FeatureDefinition>();
  private readonly initialized = new Set<string>();

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

  async initPhase(
    phase: FeaturePhase,
    ctx: FeatureContext,
    readPref: PrefReader,
    win?: Window,
  ): Promise<void> {
    for (const def of this.enabledFeatures(phase, readPref)) {
      if (this.initialized.has(def.id)) continue;
      await def.init(ctx, win);
      this.initialized.add(def.id);
    }
  }

  shutdownAll(): void {
    for (const id of [...this.initialized].reverse()) {
      this.features.get(id)?.shutdown?.();
      this.initialized.delete(id);
    }
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
