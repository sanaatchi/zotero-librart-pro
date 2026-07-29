import {
  dispatchActionByEvent,
  dispatchActionByKey,
  dispatchActionByShortcut,
} from "./modules/dispatch";
import { ExtraFieldTool, ClipboardHelper } from "zotero-plugin-toolkit";
import { getActions, updateAction, deleteAction } from "./utils/actions";
import { getZoteroAdapter } from "./adapters/zoteroAdapter";
import { getFeatureRegistry } from "./core/featureRegistry";

const actionManager = {
  dispatchActionByEvent,
  dispatchActionByKey,
  dispatchActionByShortcut,
  getActions,
  updateAction,
  deleteAction,
};

const utils = {
  ClipboardHelper,
  ExtraField: new ExtraFieldTool(),
};

export default {
  actionManager,
  utils,
  zotero: getZoteroAdapter,
  features: getFeatureRegistry,
};
