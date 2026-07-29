// @ajan: cursor · @etiket: f9.2.2, zotseek, fetch-assets
/**
 * Fetch / copy ZotSeek WASM + ONNX into addon/content/ (gitignored binaries).
 *
 * Usage:
 *   node scripts/fetch-zotseek-assets.mjs
 *
 * Sources (first win):
 * 1) referanslar/ZotSeek-1.18.0/content (wasm always; onnx if >1MB)
 * 2) Hugging Face Xenova/nomic-embed-text-v1.5 for ONNX + tokenizer JSON
 * 3) node_modules/@huggingface/transformers dist wasm (if installed)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REF = path.resolve(
  ROOT,
  "..",
  "referanslar",
  "ZotSeek-1.18.0",
  "content",
);
const OUT = path.join(ROOT, "addon", "content");
const MIN_ONNX = 1_000_000;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  const size = fs.statSync(dest).size;
  console.log(`copied ${path.relative(ROOT, dest)} (${size} bytes)`);
  return size;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(dest));
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => resolve(fs.statSync(dest).size));
        });
      })
      .on("error", (err) => {
        try {
          file.close();
          fs.unlinkSync(dest);
        } catch {
          /* soft */
        }
        reject(err);
      });
  });
}

async function main() {
  const wasmSrc = path.join(REF, "wasm", "ort-wasm-simd-threaded.jsep.wasm");
  const wasmMjsSrc = path.join(REF, "wasm", "ort-wasm-simd-threaded.jsep.mjs");
  const onnxRef = path.join(
    REF,
    "models",
    "Xenova",
    "nomic-embed-text-v1.5",
    "onnx",
    "model_quantized.onnx",
  );
  const modelDir = path.join(OUT, "models", "Xenova", "nomic-embed-text-v1.5");

  if (fs.existsSync(wasmSrc)) {
    copyFile(
      wasmSrc,
      path.join(OUT, "wasm", "ort-wasm-simd-threaded.jsep.wasm"),
    );
  } else {
    console.warn(
      "WASM missing in referanslar — install @huggingface/transformers and re-run, or copy manually",
    );
  }
  if (fs.existsSync(wasmMjsSrc)) {
    copyFile(
      wasmMjsSrc,
      path.join(OUT, "wasm", "ort-wasm-simd-threaded.jsep.mjs"),
    );
  }

  const jsonNames = ["config.json", "tokenizer.json", "tokenizer_config.json"];
  for (const name of jsonNames) {
    const src = path.join(
      REF,
      "models",
      "Xenova",
      "nomic-embed-text-v1.5",
      name,
    );
    if (fs.existsSync(src)) {
      copyFile(src, path.join(modelDir, name));
    }
  }

  let onnxOk = false;
  if (fs.existsSync(onnxRef) && fs.statSync(onnxRef).size >= MIN_ONNX) {
    copyFile(onnxRef, path.join(modelDir, "onnx", "model_quantized.onnx"));
    onnxOk = true;
  } else {
    if (fs.existsSync(onnxRef)) {
      console.warn(
        `referanslar ONNX looks like LFS pointer (${fs.statSync(onnxRef).size} B) — downloading from Hugging Face…`,
      );
    } else {
      console.warn(
        "ONNX missing in referanslar — downloading from Hugging Face…",
      );
    }
    const hf =
      "https://huggingface.co/Xenova/nomic-embed-text-v1.5/resolve/main/onnx/model_quantized.onnx";
    const dest = path.join(modelDir, "onnx", "model_quantized.onnx");
    const size = await download(hf, dest);
    console.log(`downloaded ONNX (${size} bytes)`);
    onnxOk = size >= MIN_ONNX;
    for (const name of jsonNames) {
      const destJson = path.join(modelDir, name);
      if (!fs.existsSync(destJson)) {
        const u = `https://huggingface.co/Xenova/nomic-embed-text-v1.5/resolve/main/${name}`;
        const s = await download(u, destJson);
        console.log(`downloaded ${name} (${s} bytes)`);
      }
    }
  }

  console.log(
    onnxOk
      ? "Assets ready. Next: npm run build:worker (needs @huggingface/transformers)"
      : "ONNX still missing — fat XPI / vendored-ready will stay false",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
