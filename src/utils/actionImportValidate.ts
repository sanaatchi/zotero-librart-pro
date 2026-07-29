// @ajan: cursor · @etiket: f0, yaml, security, actions
import yaml from "js-yaml";
import { ActionData, ActionEventTypes, ActionOperationTypes } from "./actions";

export {
  ACTION_IMPORT_TYPES,
  parseActionImportYaml,
  validateActionImportPayload,
  validateImportedAction,
};

/** Legacy ActionsTags export type kept for backward-compatible imports. */
const ACTION_IMPORT_TYPES = ["LibRartProBackup", "ActionsTagsBackup"] as const;

type ActionImportType = (typeof ACTION_IMPORT_TYPES)[number];

export type ActionImportPayload = {
  type: ActionImportType;
  author?: string;
  platformVersion?: string;
  pluginVersion?: string;
  timestamp?: string;
  actions: Record<string, ActionData | string>;
};

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Parse YAML with a restricted schema (no custom tags / anchors).
 */
function parseActionImportYaml(raw: string): unknown {
  return yaml.load(raw, {
    schema: yaml.JSON_SCHEMA,
    json: true,
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateImportedAction(value: unknown): value is ActionData {
  if (!isPlainObject(value)) return false;
  const event = value.event;
  const operation = value.operation;
  const data = value.data;
  if (typeof event !== "number" || !(event in ActionEventTypes)) return false;
  if (typeof operation !== "number" || !(operation in ActionOperationTypes))
    return false;
  if (typeof data !== "string") return false;
  if ("enabled" in value && typeof value.enabled !== "boolean") return false;
  if ("shortcut" in value && typeof value.shortcut !== "string") return false;
  if ("menu" in value && typeof value.menu !== "string") return false;
  if ("name" in value && typeof value.name !== "string") return false;
  return true;
}

function validateActionImportPayload(obj: unknown): obj is ActionImportPayload {
  if (!isPlainObject(obj)) return false;
  if (typeof obj.type !== "string") return false;
  if (!ACTION_IMPORT_TYPES.includes(obj.type as ActionImportType)) return false;
  if (!isPlainObject(obj.actions)) return false;
  const keys = Object.keys(obj.actions);
  if (!keys.length) return false;
  for (const key of keys) {
    if (!key.trim() || FORBIDDEN_KEYS.has(key)) return false;
    const entry = obj.actions[key];
    if (typeof entry === "string") continue;
    if (!validateImportedAction(entry)) return false;
  }
  return true;
}
