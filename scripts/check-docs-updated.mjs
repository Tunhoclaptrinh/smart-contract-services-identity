// Fails when a branch changes code without the document that describes it (CLAUDE.md §4):
//   service/src/**              → service/SERVICE.md (code map, endpoints, flow)
//   packages/nest-common/src/** → packages/nest-common/MODULES.md (base work only)
// A commit message containing "[no-docs]" (with a reason) lets a change through on purpose.
//
// Compared range: merge base with the branch the work goes into (origin/main, or origin/base for
// base work) up to HEAD. Pushes to main and base themselves are skipped: their changes arrive
// through a checked branch or come from the base owner, who runs `pnpm check:docs` before pushing.
//
// Usage: node scripts/check-docs-updated.mjs      (CI runs it on every push and pull request)
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const tryGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

const event = process.env.GITHUB_EVENT_NAME ?? "local";
const head =
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  git("branch", "--show-current");
if (event === "push" && ["main", "base"].includes(head)) {
  console.log(`docs check skipped: direct push to ${head}`);
  process.exit(0);
}
const baseWork = head === "base" || head.startsWith("core/");
const target = process.env.GITHUB_BASE_REF || (baseWork ? "base" : "main");
if (head === target) {
  console.log(`docs check skipped: ${head} is the target branch itself`);
  process.exit(0);
}
tryGit("fetch", "--quiet", "origin", `${target}:refs/remotes/origin/${target}`);
const mergeBase = tryGit("merge-base", "HEAD", `origin/${target}`);
if (!mergeBase) {
  console.error(
    `docs check: no common history with origin/${target} (shallow clone? use fetch-depth: 0)`,
  );
  process.exit(1);
}

// Merges bring in work already checked elsewhere (a pulled base, main merged into a branch):
// only files changed by this branch's own commits count.
const changed = new Set(
  git("log", "--no-merges", "--name-only", "--format=", `${mergeBase}..HEAD`)
    .split("\n")
    .filter(Boolean),
);
const messages = git("log", "--no-merges", "--format=%B", `${mergeBase}..HEAD`);
if (/\[no-docs\]/i.test(messages)) {
  console.log("docs check skipped: [no-docs] in a commit message");
  process.exit(0);
}

const files = [...changed];
const touches = (prefix) => files.some((f) => f.startsWith(prefix));
const rules = [
  {
    when: (f) =>
      f.startsWith("service/src/") && !/\.(test|spec)\.[cm]?[jt]s$/.test(f),
    need: "service/SERVICE.md",
    what: "service code (update the code map, endpoints or flow)",
  },
  {
    when: (f) => baseWork && f.startsWith("packages/nest-common/src/"),
    need: "packages/nest-common/MODULES.md",
    what: "chassis code (update the module map)",
  },
];
const missing = rules.filter(
  (rule) => files.some(rule.when) && !touches(rule.need),
);
if (missing.length) {
  for (const rule of missing)
    console.error(
      `docs check: ${rule.what} changed, but ${rule.need} did not.\n  ${files
        .filter(rule.when)
        .join("\n  ")}`,
    );
  console.error(
    "\nUpdate the document in this branch (CLAUDE.md §4), or add a line " +
      '"[no-docs] <reason>" to a commit message when nothing it describes changed.',
  );
  process.exit(1);
}
console.log(
  `docs check passed: ${files.length} changed file(s) vs origin/${target}`,
);
