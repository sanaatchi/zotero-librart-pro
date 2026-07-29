// @ts-nocheck — upstream ZotSeek model registry (chrome:// asset paths)
/**
 * Model registry: selectable local embedding models (ZotSeek MIT, remapped).
 * @ajan: cursor · @etiket: f9.2.2, zotseek, model-registry
 */
import { config } from "../../../../package.json";

declare const Zotero: any;

export interface ModelConfig {
  id: string;
  label: string;
  hfPath: string;
  dimensions: number;
  pooling: "mean" | "cls";
  normalize: boolean;
  queryPrefix: string;
  docPrefix: string;
  onnxFile: string;
  files: string[];
  bundled: boolean;
  approxSizeMB: number;
  multilingual: boolean;
}

const COMMON_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
];

export const MODELS: ModelConfig[] = [
  {
    id: "nomic-embed-text-v1.5",
    label: "Nomic v1.5 (English, balanced)",
    hfPath: "Xenova/nomic-embed-text-v1.5",
    dimensions: 768,
    pooling: "mean",
    normalize: true,
    queryPrefix: "search_query: ",
    docPrefix: "search_document: ",
    onnxFile: "onnx/model_quantized.onnx",
    files: [...COMMON_FILES, "onnx/model_quantized.onnx"],
    bundled: true,
    approxSizeMB: 130,
    multilingual: false,
  },
  {
    id: "paraphrase-multilingual-MiniLM-L12-v2",
    label: "MiniLM multilingual (small, fast)",
    hfPath: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    dimensions: 384,
    pooling: "mean",
    normalize: true,
    queryPrefix: "",
    docPrefix: "",
    onnxFile: "onnx/model_quantized.onnx",
    files: [...COMMON_FILES, "onnx/model_quantized.onnx"],
    bundled: false,
    approxSizeMB: 135,
    multilingual: true,
  },
  {
    id: "multilingual-e5-base",
    label: "Multilingual E5 base",
    hfPath: "Xenova/multilingual-e5-base",
    dimensions: 768,
    pooling: "mean",
    normalize: true,
    queryPrefix: "query: ",
    docPrefix: "passage: ",
    onnxFile: "onnx/model_quantized.onnx",
    files: [...COMMON_FILES, "onnx/model_quantized.onnx"],
    bundled: false,
    approxSizeMB: 110,
    multilingual: true,
  },
  {
    id: "bge-m3",
    label: "BGE-M3 (top multilingual)",
    hfPath: "Xenova/bge-m3",
    dimensions: 1024,
    pooling: "cls",
    normalize: true,
    queryPrefix: "",
    docPrefix: "",
    onnxFile: "onnx/model_quantized.onnx",
    files: [...COMMON_FILES, "onnx/model_quantized.onnx"],
    bundled: false,
    approxSizeMB: 570,
    multilingual: true,
  },
];

export const DEFAULT_MODEL_ID = "nomic-embed-text-v1.5";

export function getAllModels(): ModelConfig[] {
  return [...MODELS];
}

export function getModel(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id);
}

export function isAllowedHfPath(hfPath: string): boolean {
  return MODELS.some((m) => m.hfPath === hfPath);
}

export function legacyModelIdToShortId(stored: string): string {
  const byHf = MODELS.find((m) => m.hfPath === stored);
  if (byHf) return byHf.id;
  return stored;
}

export function getActiveModelId(): string {
  try {
    const v = Zotero.Prefs.get(`${config.prefsPrefix}.embeddingModel`, true);
    if (typeof v === "string" && getModel(v)) return v;
  } catch (e: any) {
    Zotero.debug(
      "[LibRart:ZotSeek] getActiveModelId error: " + (e?.message || e),
    );
  }
  return DEFAULT_MODEL_ID;
}

export function getActiveModel(): ModelConfig {
  return getModel(getActiveModelId()) || getModel(DEFAULT_MODEL_ID)!;
}

export function setActiveModelId(id: string): void {
  try {
    Zotero.Prefs.set(`${config.prefsPrefix}.embeddingModel`, id, true);
  } catch (e: any) {
    Zotero.debug(
      "[LibRart:ZotSeek] setActiveModelId error: " + (e?.message || e),
    );
  }
}

export function modelBasePath(model: ModelConfig): string {
  return model.bundled
    ? `chrome://${config.addonRef}/content/models/`
    : `resource://${config.addonRef}-models/`;
}

export function applyPrefix(
  text: string,
  kind: "query" | "doc",
  model: ModelConfig,
): string {
  const prefix = kind === "query" ? model.queryPrefix : model.docPrefix;
  return prefix ? prefix + text : text;
}
