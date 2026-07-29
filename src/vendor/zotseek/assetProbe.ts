// @ajan: cursor · @etiket: f9.2.2, zotseek, asset-probe
// Pure helpers: detect real ONNX/WASM vs Git LFS pointer stubs.

export type VendoredAssetSizes = {
  onnxBytes: number | null;
  wasmBytes: number | null;
  workerBytes: number | null;
};

export type VendoredAssetPresence = {
  onnxOk: boolean;
  wasmOk: boolean;
  workerOk: boolean;
  ready: boolean;
  reason:
    | "ok"
    | "missing-onnx"
    | "missing-wasm"
    | "missing-worker"
    | "lfs-pointer";
};

/** LFS pointers are tiny (~100–200 B); real nomic ONNX is ~130MB. */
export const MIN_ONNX_BYTES = 1_000_000;
/** ORT wasm is ~20MB. */
export const MIN_WASM_BYTES = 1_000_000;
/** Bundled embedding-worker.js with transformers is typically >100KB. */
export const MIN_WORKER_BYTES = 50_000;

export {
  isLikelyLfsPointerSize,
  evaluateVendoredAssetPresence,
  defaultBundledModelRelPath,
  defaultWasmRelPath,
  defaultWorkerRelPath,
};

function isLikelyLfsPointerSize(bytes: number | null | undefined): boolean {
  if (bytes == null || !Number.isFinite(bytes)) return true;
  return bytes > 0 && bytes < 1024;
}

function evaluateVendoredAssetPresence(
  sizes: VendoredAssetSizes,
): VendoredAssetPresence {
  const onnxOk =
    sizes.onnxBytes != null &&
    sizes.onnxBytes >= MIN_ONNX_BYTES &&
    !isLikelyLfsPointerSize(sizes.onnxBytes);
  const wasmOk =
    sizes.wasmBytes != null &&
    sizes.wasmBytes >= MIN_WASM_BYTES &&
    !isLikelyLfsPointerSize(sizes.wasmBytes);
  const workerOk =
    sizes.workerBytes != null && sizes.workerBytes >= MIN_WORKER_BYTES;

  if (
    sizes.onnxBytes != null &&
    isLikelyLfsPointerSize(sizes.onnxBytes) &&
    sizes.onnxBytes > 0
  ) {
    return {
      onnxOk: false,
      wasmOk,
      workerOk,
      ready: false,
      reason: "lfs-pointer",
    };
  }
  if (!onnxOk) {
    return {
      onnxOk: false,
      wasmOk,
      workerOk,
      ready: false,
      reason: "missing-onnx",
    };
  }
  if (!wasmOk) {
    return {
      onnxOk: true,
      wasmOk: false,
      workerOk,
      ready: false,
      reason: "missing-wasm",
    };
  }
  if (!workerOk) {
    return {
      onnxOk: true,
      wasmOk: true,
      workerOk: false,
      ready: false,
      reason: "missing-worker",
    };
  }
  return {
    onnxOk: true,
    wasmOk: true,
    workerOk: true,
    ready: true,
    reason: "ok",
  };
}

function defaultBundledModelRelPath(): string {
  return "models/Xenova/nomic-embed-text-v1.5/onnx/model_quantized.onnx";
}

function defaultWasmRelPath(): string {
  return "wasm/ort-wasm-simd-threaded.jsep.wasm";
}

function defaultWorkerRelPath(): string {
  return "scripts/embedding-worker.js";
}
