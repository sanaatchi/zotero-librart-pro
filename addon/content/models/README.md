<!-- @ajan: cursor · @etiket: f9.2.2, zotseek, assets-readme -->

# Vendored ZotSeek assets (not in git)

```bash
npm run fetch:zotseek-assets   # ONNX (~130MB) + ORT WASM (~21MB)
npm i -D @huggingface/transformers@^3.8.1
npm run build:worker           # embedding-worker.js
npm run build
```

Binaries are gitignored. Without them, semantic falls back to Kutuphane 8756 / external ZotSeek.
F9.2.3 will add the vector index for `findSimilar`.
