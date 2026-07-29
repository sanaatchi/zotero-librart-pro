// @ajan: cursor · @etiket: f9.2.2, zotseek, asset-probe, runtime
// Resolve chrome://librartpro content sizes for vendored ZotSeek assets.

import { config } from "../../../package.json";
import {
  VendoredAssetPresence,
  VendoredAssetSizes,
  defaultBundledModelRelPath,
  defaultWasmRelPath,
  defaultWorkerRelPath,
  evaluateVendoredAssetPresence,
} from "./assetProbe";

export { probeVendoredZotSeekAssets, chromeContentUrl };

function chromeContentUrl(relPath: string): string {
  return `chrome://${config.addonRef}/content/${relPath.replace(/^\/+/, "")}`;
}

function getRootURI(): string | null {
  try {
    const g = globalThis as { rootURI?: string };
    if (typeof g.rootURI === "string" && g.rootURI) return g.rootURI;
  } catch {
    /* soft */
  }
  return null;
}

/**
 * Best-effort content length for a chrome:// or file URI.
 * Avoids reading the full ONNX into memory.
 */
async function probeContentLength(url: string): Promise<number | null> {
  try {
    const root = getRootURI();
    if (root && root.startsWith("file:")) {
      const base = root.replace(/\/?$/, "/");
      const full =
        url.startsWith("chrome://")
          ? base + "content/" + url.split("/content/")[1]
          : url;
      if (full.startsWith("file:")) {
        let path = full.replace(/^file:\/\//i, "");
        if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1);
        path = decodeURIComponent(path);
        if (await IOUtils.exists(path)) {
          const stat = await IOUtils.stat(path);
          return typeof stat.size === "number" ? stat.size : null;
        }
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const Services = ztoolkit.getGlobal("Services") as {
      io: {
        newURI: (spec: string) => unknown;
        newChannelFromURI: (uri: unknown) => {
          contentLength: number;
          asyncOpen?: unknown;
          open: () => { close: () => void };
        };
      };
    };
    const uri = Services.io.newURI(url);
    const channel = Services.io.newChannelFromURI(uri);
    try {
      const stream = channel.open();
      try {
        const len = channel.contentLength;
        if (typeof len === "number" && len >= 0) return len;
      } finally {
        stream.close();
      }
    } catch {
      const len = channel.contentLength;
      if (typeof len === "number" && len >= 0) return len;
    }
  } catch {
    /* soft */
  }

  return null;
}

async function probeVendoredZotSeekAssets(): Promise<VendoredAssetPresence> {
  const sizes: VendoredAssetSizes = {
    onnxBytes: await probeContentLength(
      chromeContentUrl(defaultBundledModelRelPath()),
    ),
    wasmBytes: await probeContentLength(chromeContentUrl(defaultWasmRelPath())),
    workerBytes: await probeContentLength(
      chromeContentUrl(defaultWorkerRelPath()),
    ),
  };
  return evaluateVendoredAssetPresence(sizes);
}
