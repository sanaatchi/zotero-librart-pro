// Publish a release to the PUBLIC dist repo so Zotero can auto-update.
// Source stays private in sanaatchi/eylemler-ve-etiketler.
//
// Usage:
//   npm run gh-release
//   node scripts/publish.mjs --notes "Tag Analysis fix"
//
// Prerequisites: `gh auth login`, DIST_REPO must exist (created once).

import { execSync } from "node:child_process";
import {
  readdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DIST_REPO = "sanaatchi/eylemler-ve-etiketler-releases";
const SOURCE_REPO = "sanaatchi/eylemler-ve-etiketler";

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
    : `Actions and Tags ${tag}`;

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

/**
 * GitHub's /releases/latest/download/<name> CDN often serves a stale
 * same-named asset from a previous release. Prefer:
 * - versioned XPI links in update.json
 * - update.json on the dist repo's default branch (raw.githubusercontent)
 */
function writeUpdateFiles(xpiName) {
  const updateLink = `https://github.com/${DIST_REPO}/releases/download/${tag}/${xpiName}`;
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
  const body = JSON.stringify(updateJson, null, 2) + "\n";
  writeFileSync("update.json", body);
  writeFileSync("update-beta.json", body);
  console.log("Wrote update.json →", updateLink);
  return body;
}

function publishUpdateJsonToBranch(body) {
  // Keep a stable update manifest on main — not subject to latest/download CDN bugs.
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

console.log(`\n=== Building ${tag} ===`);
run("npm run build");

const xpiPath = findXpi();
const xpiName = xpiPath.replace(/\\/g, "/").split("/").pop();
const updateBody = writeUpdateFiles(xpiName);

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

// Also clobber update.json on the previous release asset name path used by
// older installs that still point at /releases/latest/download/update.json.
// Uploading a matching file onto the Latest release is already done above;
// additionally rewrite a few recent tags so CDN/stale pointers still advertise
// the newest version.
try {
  const list = execSync(
    `gh release list --repo ${DIST_REPO} --limit 5 --json tagName`,
    { encoding: "utf8", shell: true },
  );
  const tags = JSON.parse(list)
    .map((r) => r.tagName)
    .filter((t) => t && t !== tag);
  for (const oldTag of tags.slice(0, 3)) {
    try {
      run(
        `gh release upload ${oldTag} update.json --repo ${DIST_REPO} --clobber`,
      );
    } catch (e) {
      console.warn(`Could not clobber update.json on ${oldTag}:`, e.message || e);
    }
  }
} catch (e) {
  console.warn("Stale-release update.json clobber skipped:", e.message || e);
}

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
  XPI:     https://github.com/${DIST_REPO}/releases/download/${tag}/${xpiName}

Zotero picks this up via Add-ons → Check for Updates
(or install the XPI from the Dist link once).
`);
