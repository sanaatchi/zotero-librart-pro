import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

const DIST_REPO = "sanaatchi/zotero-actions-tags-releases";

export default defineConfig({
  source: ["src", "addon"],
  dist: "build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  // Public releases repo — Zotero updater has no GitHub auth.
  updateURL: pkg.config.updateJSON,
  xpiDownloadLink: `https://github.com/${DIST_REPO}/releases/download/v{{version}}/{{xpiName}}.xpi`,

  server: {
    asProxy: false,
  },

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
    makeUpdateJson: {
      hash: false,
    },
  },
});
