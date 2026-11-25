#!/usr/bin/env bash
# Creates a service repository from this repository's base branch (docs/KIEN_TRUC_REPO.md).
# Usage: scripts/new-service.sh <name> [target-dir]   (default: ../btl-backend-<name>, beside this repository)
set -euo pipefail
name="${1:?usage: $0 <name> [target-dir]}"
[[ "$name" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "name: lower-case letters, digits, dashes" >&2; exit 1; }
parent="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
target="${2:-$(dirname "$parent")/btl-backend-${name}}"
upstream="$(git -C "$parent" remote get-url origin)"
[ -e "$target" ] && { echo "$target already exists" >&2; exit 1; }
git clone --quiet --branch base --single-branch "$parent" "$target"
cd "$target"
git branch -m base main
git remote set-url origin "git@github.com:Tunhoclaptrinh/smart-contract-services-${name}.git"
# The clone took one branch; the service repository tracks all of its own branches.
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git remote add upstream "$upstream"
node -e '
const fs = require("node:fs");
const p = "service/package.json";
const d = JSON.parse(fs.readFileSync(p, "utf8"));
d.name = "@sc/" + process.argv[1] + "-service";
fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
const m = "service/src/main.ts";
fs.writeFileSync(m, fs.readFileSync(m, "utf8").replace(/name: "service"/, "name: \"" + process.argv[1] + "\""));
for (const f of ["service/CHANGELOG.md"])
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("— service", "— " + process.argv[1]));
const c = "service/SERVICE.md";
fs.writeFileSync(c, fs.readFileSync(c, "utf8").replaceAll("`service`", "`" + process.argv[1] + "`").replace("PG_SCHEMA=service", "PG_SCHEMA=" + process.argv[1]).replace("/api/service/", "/api/" + process.argv[1] + "/"));
' "$name"
echo "created $target (origin: smart-contract-services-${name}, upstream: ${upstream})"
