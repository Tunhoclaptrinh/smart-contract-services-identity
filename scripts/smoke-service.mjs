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
  // RFC 9457 problem details, with the previous fields kept for older clients.
  assert.match(
    resources.headers.get("content-type"),
    /application\/problem\+json/,
  );
  assert.equal(problem.status, 401);
  assert.equal(problem.traceId, problem.requestId);
  assert.ok(problem.type && problem.title && problem.detail);
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
  // The global ValidationPipe checks the query shape before any handler runs.
  const auth = { headers: { authorization: `Bearer ${token}` } };
  const tooMany = await fetch(`${base}/resources/settings?limit=999`, auth);
  assert.equal(tooMany.status, 400);
  const tooManyBody = await tooMany.json();
  assert.deepEqual(tooManyBody.errors, [
    { field: "limit", code: "INVALID_NUMBER" },
  ]);
  const unknown = await fetch(`${base}/resources/settings?bogus=1`, auth);
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).errors[0].code, "UNKNOWN_FIELD");
  const badBulk = await fetch(`${base}/resources/settings/bulk-delete`, {
    method: "POST",
    headers: { ...auth.headers, "content-type": "application/json" },
    body: JSON.stringify({ ids: [] }),
  });
  assert.equal(badBulk.status, 400);
  assert.equal((await badBulk.json()).errors[0].field, "ids");
  console.log(
    "service smoke passed: health, auth required, token accepted, forged token refused, problem+json, DTO validation",
  );
} finally {
  child.kill();
  rmSync(dataDir, { recursive: true, force: true });
}
