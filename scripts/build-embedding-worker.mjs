// @ajan: cursor · @etiket: f9.2.2, zotseek, build-worker
/**
 * Bundle embedding-worker.js (Transformers.js + ORT). Optional — not part of
 * default `npm run build` so the slim XPI stays small until assets are fetched.
 *
 *   npm i -D @huggingface/transformers@^3.8.1
 *   npm run build:worker
 */
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const entry = path.join(
  ROOT,
  "src",
  "vendor",
  "zotseek",
  "worker",
  "embedding-worker.ts",
);
const outfile = path.join(
  ROOT,
  "addon",
  "content",
  "scripts",
  "embedding-worker.js",
);

try {
  require.resolve("@huggingface/transformers");
} catch {
  console.error(
    "Missing @huggingface/transformers. Install:\n  npm i -D @huggingface/transformers@^3.8.1",
  );
  process.exit(1);
}

if (!fs.existsSync(entry)) {
  console.error("Missing worker source:", entry);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  outfile,
  format: "iife",
  platform: "browser",
  target: ["firefox115"],
  logLevel: "info",
});

const size = fs.statSync(outfile).size;
console.log(`Wrote ${path.relative(ROOT, outfile)} (${size} bytes)`);
console.log("Also run: node scripts/fetch-zotseek-assets.mjs");
