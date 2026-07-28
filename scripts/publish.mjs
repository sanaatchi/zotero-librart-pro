// Publish a release to the PUBLIC dist repo so Zotero can auto-update.
// Source stays private in sanaatchi/zotero-actions-tags.
//
// Usage:
//   npm run gh-release
//   node scripts/publish.mjs --notes "Tag Analysis fix"
//
// Prerequisites: `gh auth login`, DIST_REPO must exist (created once).

import { execSync } from "node:child_process";
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST_REPO = "sanaatchi/zotero-actions-tags-releases";
const SOURCE_REPO = "sanaatchi/zotero-actions-tags";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const version = pkg.version;
const tag = `v${version}`;
const addonID = pkg.config.addonID;

const notesArg = process.argv.indexOf("--notes");
const notes =
  notesArg !== -1 && process.argv[notesArg + 1]
    ? process.argv[notesArg + 1]
    : `Actions and Tags ${tag} (Tag Analysis Dashboard)`;

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", shell: true });
}

function findXpi() {
  const buildDir = join(process.cwd(), "build");
  const xpIs = readdirSync(buildDir).filter((f) => f.endsWith(".xpi"));
  if (!xpIs.length) {
    throw new Error("No .xpi found in build/ — run build first");
  }
  return join("build", xpIs[0]);
}

console.log(`\n=== Building ${tag} ===`);
run("npm run build");

const xpiPath = findXpi();
const xpiName = xpiPath.replace(/\\/g, "/").split("/").pop();
const updateLink = `https://github.com/${DIST_REPO}/releases/latest/download/${xpiName}`;

const updateJson = {
  addons: {
    [addonID]: {
      updates: [
        {
          version,
          update_link: updateLink,
          applications: {
            zotero: {
              strict_min_version: "7.999",
              strict_max_version: "10.999.999",
            },
          },
        },
      ],
    },
  },
};

writeFileSync("update.json", JSON.stringify(updateJson, null, 2) + "\n");
writeFileSync(
  "update-beta.json",
  JSON.stringify(updateJson, null, 2) + "\n",
);
console.log("Wrote update.json →", updateLink);

console.log(`\n=== Publishing ${tag} to ${DIST_REPO} ===`);
try {
  execSync(`gh release view ${tag} --repo ${DIST_REPO}`, { stdio: "ignore" });
  console.log(`Release ${tag} exists — deleting to replace assets.`);
  run(`gh release delete ${tag} --repo ${DIST_REPO} --yes --cleanup-tag`);
} catch {
  // first publish for this tag
}

const notesEscaped = notes.replace(/"/g, '\\"');
run(
  `gh release create ${tag} "${xpiPath}" update.json ` +
    `--repo ${DIST_REPO} --title "${tag}" --notes "${notesEscaped}"`,
);

// Mirror tag on private source repo (optional convenience)
try {
  run(`git tag -f ${tag}`);
  run(`git push -f origin ${tag}`);
} catch (e) {
  console.warn("Source-repo tag push skipped:", e.message || e);
}

console.log(`
Done.
  Dist:    https://github.com/${DIST_REPO}/releases/tag/${tag}
  Source:  https://github.com/${SOURCE_REPO}
  Update:  ${pkg.config.updateJSON}

Zotero picks this up via Add-ons → Check for Updates
(after one-time install of this build with the new addon ID).
`);
