import {
  ProgressWindowHelper,
  ColumnOptions,
  VirtualizedTableHelper,
} from "zotero-plugin-toolkit";
import { createZToolkit } from "./utils/ztoolkit";
import { ActionMap } from "./utils/actions";
import hooks from "./hooks";
import api from "./api";
import { config } from "../package.json";
import type { ConnectionGraph } from "./utils/connectionGraph";
import type { SemanticCacheEntry } from "./utils/connectionSemanticLayer";

class Addon {
  public data: {
    alive: boolean;
    // Env type, see build.js
    env: "development" | "production";
    config: typeof config;
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    prefs: {
      window?: Window;
      tableHelper?: VirtualizedTableHelper;
      dialogWindow?: Window;
      editorWindow?: Window;
      editorInstance?: any;
      columns: ColumnOptions[];
      columnIndex: number;
      columnAscending: boolean;
    };
    actions: {
      map: ActionMap;
      cachedKeys: string[];
      selectedKey?: string;
    };
    tabStatus: Map<string, number>;
    hint: {
      total: number;
      current: number;
      progressHelper?: ProgressWindowHelper;
    };
    tagDashboard: {
      window?: Window;
    };
    connectionMap: {
      window?: Window;
      semanticCache?: Map<number, SemanticCacheEntry[]>;
      /** Session-dismissed semantic edge ids. */
      dismissedSemanticIds?: Set<string>;
      lastGraph?: ConnectionGraph;
    };
  };
  // Lifecycle hooks
  public hooks: typeof hooks;
  // APIs
  public api: typeof api;

  constructor() {
    this.data = {
      alive: true,
      env: __env__,
      config,
      ztoolkit: createZToolkit(),
      prefs: {
        columns: [],
        columnIndex: 0,
        columnAscending: false,
      },
      actions: {
        map: new Map(),
        cachedKeys: [],
      },
      tabStatus: new Map(),
      hint: {
        total: 0,
        current: 0,
      },
      tagDashboard: {},
      connectionMap: {},
    };
    this.hooks = hooks;
    this.api = api;
  }
}

export default Addon;
