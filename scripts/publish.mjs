// Publish a release to the PUBLIC dist repo so Zotero can auto-update.
// Source stays private in sanaatchi/zotero-librart-pro.
//
// Update channel (same pattern as Translate for Zotero):
//   manifest update_url →
//   https://github.com/.../releases/download/update/update.json
//
// Usage:
//   npm run gh-release
//   node scripts/publish.mjs --notes "Tag Analysis fix"
//
// Prerequisites: `gh auth login`, DIST_REPO must exist (created once).

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DIST_REPO = "sanaatchi/zotero-librart-pro-releases";
const SOURCE_REPO = "sanaatchi/zotero-librart-pro";
const UPDATE_RELEASE = "update";
const UPDATE_URL = `https://github.com/${DIST_REPO}/releases/download/${UPDATE_RELEASE}/update.json`;

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
    : `LibRart Pro ${tag}`;

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

function sha512File(filePath) {
  return createHash("sha512").update(readFileSync(filePath)).digest("hex");
}

function writeUpdateFiles(xpiPath, xpiName) {
  const updateLink = `https://github.com/${DIST_REPO}/releases/download/${tag}/${xpiName}`;
  const updateHash = `sha512:${sha512File(xpiPath)}`;
  const updateJson = {
    addons: {
      [addonID]: {
        updates: [
          {
            version,
            update_link: updateLink,
            update_hash: updateHash,
            applications: {
              zotero: {
                strict_min_version: "7.0",
                strict_max_version: "10.9.9",
              },
            },
          },
        ],
      },
    },
  };
  const body = JSON.stringify(updateJson, null, 2) + "\n";
  writeFileSync("update.json", body);
  writeFileSync("update-beta.json", body);
  console.log("Wrote update.json →", updateLink);
  console.log("update_hash →", updateHash);
  return body;
}

function publishUpdateJsonToBranch(body) {
  const path = "update.json";
  let sha;
  try {
    const meta = execSync(
      `gh api repos/${DIST_REPO}/contents/${path}?ref=main`,
      { encoding: "utf8", shell: true },
    );
    sha = JSON.parse(meta).sha;
  } catch {
    sha = undefined;
  }

  const payload = {
    message: `chore: sync update.json to ${tag}`,
    content: Buffer.from(body, "utf8").toString("base64"),
    branch: "main",
  };
  if (sha) payload.sha = sha;

  const tmp = join(tmpdir(), `evt-update-put-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify(payload));
  try {
    run(`gh api --method PUT repos/${DIST_REPO}/contents/${path} --input "${tmp}"`);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

/** Dedicated release holding only update.json — stable update_url target. */
function syncUpdateRelease() {
  // Full delete+recreate: --clobber / delete-asset often leaves GitHub's
  // release-assets CDN serving the previous bytes for several minutes.
  try {
    execSync(`gh release view ${UPDATE_RELEASE} --repo ${DIST_REPO}`, {
      stdio: "ignore",
    });
    run(
      `gh release delete ${UPDATE_RELEASE} --repo ${DIST_REPO} --yes --cleanup-tag`,
    );
  } catch {
    /* none yet */
  }
  run(
    `gh release create ${UPDATE_RELEASE} update.json --repo ${DIST_REPO} ` +
      `--title "update manifest" --notes "Stable Zotero auto-update manifest."`,
  );
}

function fetchUpdateManifest() {
  // Exact URL Zotero uses — no cache-buster (that can hide CDN staleness).
  return execSync(`curl -fsSL "${UPDATE_URL}"`, {
    encoding: "utf8",
    shell: true,
  });
}

/** Block until Zotero's update_url actually serves this version. */
function waitUntilUpdateVisible(expectedVersion, { attempts = 18, delayMs = 10000 } = {}) {
  console.log(`\n=== Verifying ${UPDATE_URL} serves ${expectedVersion} ===`);
  for (let i = 1; i <= attempts; i++) {
    try {
      const body = fetchUpdateManifest();
      const json = JSON.parse(body);
      const got = json?.addons?.[addonID]?.updates?.[0]?.version;
      if (got === expectedVersion) {
        console.log(`OK — update channel live at attempt ${i}: ${got}`);
        return;
      }
      console.log(`Attempt ${i}/${attempts}: channel has "${got}", want "${expectedVersion}"`);
    } catch (e) {
      console.log(`Attempt ${i}/${attempts}: fetch failed (${e.message || e})`);
    }
    if (i === 4 || i === 10) {
      console.log("CDN still stale — recreating update release…");
      try {
        syncUpdateRelease();
      } catch (e) {
        console.warn("Re-sync failed:", e.message || e);
      }
    }
    if (i < attempts) {
      execSync(`powershell -Command "Start-Sleep -Milliseconds ${delayMs}"`, {
        stdio: "ignore",
        shell: true,
      });
    }
  }
  throw new Error(
    `Update channel still not serving ${expectedVersion} after ${attempts} attempts.`,
  );
}

console.log(`\n=== Building ${tag} ===`);
run("npm run build");

const xpiPath = findXpi();
const xpiName = xpiPath.replace(/\\/g, "/").split("/").pop();
const updateBody = writeUpdateFiles(xpiPath, xpiName);

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

publishUpdateJsonToBranch(updateBody);
syncUpdateRelease();
waitUntilUpdateVisible(version);

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
  Update:  ${UPDATE_URL}
  XPI:     https://github.com/${DIST_REPO}/releases/download/${tag}/${xpiName}

Zotero: Add-ons → gear → Check for Updates  (no manual XPI reinstall needed)
`);
