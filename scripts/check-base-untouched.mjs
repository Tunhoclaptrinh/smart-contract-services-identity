// Fails when a branch outside the base flow changes base files (docs/QUY_TRINH_NHANH.md).
//
// The base of this repository is origin/base; in a service repository it is the parent's base
// branch (remote `upstream`, or fetched by URL in CI). Only changes made since the last sync
// count: `git diff <merge-base> HEAD`, so pulling a newer base never trips the check.
//
// Usage: node scripts/check-base-untouched.mjs      (CI runs it on every push and pull request)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PARENT_URL =
  "https://github.com/Tunhoclaptrinh/smart-contract-services.git";

/** What a business branch may change. Everything else belongs to the base. */
const ALLOWED = [
  "service/", // the service's own code, tests, openapi.yaml, SERVICE.md
  "packages/contracts/", // resources and permissions the service owns (data, not code)
  "pnpm-lock.yaml",
  // The root CHANGELOG.md is the base's: a service writes service/CHANGELOG.md, so pulling the
  // base never conflicts.
  "README.md",
  // Parent repository, branch main only: system-level business pieces.
  "gateway/",
  "postman/",
  "compose.yaml",
  "docs/thi-nghiem/",
  "docs/bao-cao/",
];

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const tryGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

const target =
  process.env.GITHUB_BASE_REF ||
  process.env.GITHUB_REF_NAME ||
  git("branch", "--show-current");
const head =
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  git("branch", "--show-current");
if (target === "base" || head === "base" || head.startsWith("core/")) {
  console.log(`base check skipped: ${head} → ${target} is base work`);
  process.exit(0);
}

const serviceName = JSON.parse(
  readFileSync("service/package.json", "utf8"),
).name;
// A service repository has no base branch of its own; its base is the parent's.
const hasOwnBase = Boolean(
  tryGit("ls-remote", "--exit-code", "--heads", "origin", "base"),
);
let baseRef;
if (serviceName === "@sc/service" && hasOwnBase) {
  baseRef = "origin/base";
  tryGit("fetch", "--quiet", "origin", "base:refs/remotes/origin/base");
} else {
  baseRef = "refs/remotes/upstream/base";
  const remote = tryGit("remote", "get-url", "upstream")
    ? "upstream"
    : PARENT_URL;
  git("fetch", "--quiet", remote, `base:${baseRef}`);
}

const mergeBase = tryGit("merge-base", "HEAD", baseRef);
if (!mergeBase) {
  console.error(
    `base check: no common history with ${baseRef} (shallow clone? use fetch-depth: 0)`,
  );
  process.exit(1);
}
const changed = git("diff", "--name-only", mergeBase, "HEAD")
  .split("\n")
  .filter(Boolean);
const touched = changed.filter(
  (file) => !ALLOWED.some((p) => file === p || file.startsWith(p)),
);
if (touched.length) {
  console.error(
    `These base files changed outside the base flow (${head} → ${target}):`,
  );
  for (const file of touched) console.error(`  ${file}`);
  console.error(
    "\nRevert them here and make the change on the parent repository: core/<task> → base " +
      "(docs/QUY_TRINH_NHANH.md), then pull the new base.",
  );
  process.exit(1);
}
console.log(
  `base check passed: ${changed.length} changed file(s), none of them base (vs ${baseRef})`,
);
