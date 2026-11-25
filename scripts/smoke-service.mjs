// Starts the built service on a free port with throwaway file storage and checks it answers.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { signActorToken } from "../packages/nest-common/dist/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "service-smoke-"));
const port = 3900 + Math.floor(Math.random() * 90);
const child = spawn(process.execPath, ["service/dist/main.js"], {
  env: {
    ...process.env,
    STORAGE_DRIVER: "file",
    DATA_DIR: dataDir,
    API_PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (chunk) => (log += chunk));
child.stderr.on("data", (chunk) => (log += chunk));
const base = `http://127.0.0.1:${port}/api/v1`;
try {
  let health;
  for (let attempt = 0; attempt < 60 && !health; attempt++) {
    health = await fetch(`${base}/health`).then(
      (r) => r.json(),
      () => null,
    );
    if (!health) await new Promise((done) => setTimeout(done, 500));
  }
  assert.ok(health, `service did not start:\n${log}`);
  assert.equal(health.data.status, "ok");
  assert.equal(typeof health.data.service, "string");
  // Everything but health needs a signed-in user; the error has the shared shape.
  const resources = await fetch(`${base}/resources`);
  assert.equal(resources.status, 401);
  const problem = await resources.json();
  assert.equal(typeof problem.code, "string");
  assert.ok(problem.requestId);
  // A token signed with the shared secret is accepted: the actor comes from its claims. The id
  // is the seeded system administrator, because identity also checks that the account exists.
  const token = signActorToken({
    id: "u-sysadmin",
    email: "sysadmin@example.test",
    displayName: "Smoke",
    role: "SYSTEM_ADMIN",
    organizationId: "OPS",
    roleChipOrganization: "OPS",
    partyId: null,
    title: "",
    permissions: [],
  });
  const signedIn = await fetch(`${base}/resources`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(signedIn.status, 200, await signedIn.clone().text());
  const forged = await fetch(`${base}/resources`, {
    headers: { authorization: `Bearer ${token.slice(0, -2)}xx` },
  });
  assert.equal(forged.status, 401);
  assert.equal((await forged.json()).code, "INVALID_SESSION");
  console.log(
    "service smoke passed: health, auth required, token accepted, forged token refused",
  );
} finally {
  child.kill();
  rmSync(dataDir, { recursive: true, force: true });
}
