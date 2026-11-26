// The running service over HTTP: DTO validation, status codes, refresh cookie, JWKS, rate limit.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const dataDir = mkdtempSync(join(tmpdir(), "identity-http-"));
const port = 3600 + Math.floor(Math.random() * 300);
const base = `http://127.0.0.1:${port}/api/v1`;
let child;
before(async () => {
  child = spawn(process.execPath, ["service/dist/main.js"], {
    cwd: root,
    env: {
      ...process.env,
      STORAGE_DRIVER: "file",
      DATA_DIR: dataDir,
      API_PORT: String(port),
      AUTH_RATE_LIMIT: "8",
      NODE_ENV: "development",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    const ok = await fetch(`${base}/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error("identity did not start");
});
after(() => {
  child.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const login = () =>
  post("/auth/login", { email: "sysadmin@codecash.vn", password: "Passw0rd!" });

test("malformed bodies are 400 with every field problem, unknown fields refused", async () => {
  const res = await post("/auth/register", {
    organization: { name: "", code: "bad code", kind: "NOPE" },
    admin: { email: "x", password: "short" },
    extra: 1,
  });
  assert.equal(res.status, 400);
  assert.match(res.headers.get("content-type"), /problem\+json/);
  const body = await res.json();
  const fields = body.errors.map((e) => e.field);
  for (const field of [
    "extra",
    "organization.name",
    "organization.code",
    "organization.kind",
    "admin.displayName",
    "admin.email",
    "admin.password",
  ])
    assert.ok(fields.includes(field), `${field} in ${fields}`);
});

test("sign-in is 200 with tokens and an httpOnly refresh cookie; refresh works by cookie", async () => {
  const res = await login();
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie");
  assert.match(
    cookie,
    /sc_refresh=.+; Path=\/api\/v1\/auth; HttpOnly; SameSite=Strict/,
  );
  const { data } = await res.json();
  assert.ok(data.accessToken && data.refreshToken);
  const me = await fetch(`${base}/auth/me`, {
    headers: { authorization: `Bearer ${data.accessToken}` },
  });
  assert.equal((await me.json()).data.email, "sysadmin@codecash.vn");
  const renewed = await post(
    "/auth/refresh",
    {},
    { cookie: cookie.split(";")[0] },
  );
  assert.equal(renewed.status, 200);
  assert.notEqual((await renewed.json()).data.refreshToken, data.refreshToken);
});

test("status codes: 401 without a token, 403 without the permission, 404 unknown", async () => {
  assert.equal((await fetch(`${base}/auth/me`)).status, 401);
  const supplier = await post("/auth/demo-login", {
    email: "supplier@phuminh.vn",
  });
  assert.equal(supplier.status, 200);
  const token = (await supplier.json()).data.accessToken;
  const denied = await post(
    "/auth/invitations",
    { email: "a@b.vn", displayName: "A", role: "SUPPLIER" },
    { authorization: `Bearer ${token}` },
  );
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "PERMISSION_DENIED");
  assert.equal((await fetch(`${base}/auth/invitations/nope`)).status, 404);
});

test("the JWKS is public and holds no private part", async () => {
  const res = await fetch(`${base}/.well-known/jwks.json`);
  assert.equal(res.status, 200);
  const { keys } = (await res.json()).data;
  assert.equal(keys[0].alg, "RS256");
  assert.equal(keys[0].d, undefined);
});

test("forgot password is 202 and the demo outbox shows the message", async () => {
  const res = await post("/auth/forgot-password", {
    email: "sysadmin@codecash.vn",
  });
  assert.equal(res.status, 202);
  const outbox = (await (await fetch(`${base}/auth/outbox`)).json()).data;
  assert.equal(outbox[0].kind, "PASSWORD_RESET");
  assert.match(outbox[0].link, /reset-password\?token=/);
});

test("sign-in routes are rate limited per client address", async () => {
  let limited;
  for (let i = 0; i < 12 && !limited; i++) {
    const res = await post(
      "/auth/login",
      { email: "nobody@x.vn", password: "whatever-123" },
      { "x-forwarded-for": "203.0.113.9" },
    );
    if (res.status === 429) limited = await res.json();
  }
  assert.equal(limited?.code, "TOO_MANY_REQUESTS");
  // Another client is not affected.
  const other = await post(
    "/auth/login",
    { email: "nobody@x.vn", password: "whatever-123" },
    { "x-forwarded-for": "203.0.113.10" },
  );
  assert.equal(other.status, 401);
});
