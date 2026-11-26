// RS256 access tokens: signed by identity's key, verified by public key or JWKS, HS256 refused.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";

const dir = mkdtempSync(join(tmpdir(), "jwt-"));
process.env.JWT_KEY_DIR = dir;
const {
  publicJwks,
  refreshJwks,
  signActorToken,
  verifyActorToken,
  verifyActorTokenAsync,
} = await import("../dist/index.js");
after(() => rmSync(dir, { recursive: true, force: true }));

const actor = {
  id: "u1",
  email: "a@example.test",
  displayName: "A",
  role: "SYSTEM_ADMIN",
  organizationId: "OPS",
  roleChipOrganization: "OPS",
  partyId: null,
  title: "",
  permissions: [],
};

test("a token signed with the local key verifies and carries the actor", () => {
  const token = signActorToken(actor, 3);
  const header = jwt.decode(token, { complete: true }).header;
  assert.equal(header.alg, "RS256");
  assert.ok(header.kid);
  const { actor: back, tokenVersion } = verifyActorToken(token);
  assert.equal(back.id, "u1");
  assert.equal(tokenVersion, 3);
  assert.ok(back.permissions.length > 0);
});

test("the JWKS publishes the public key only", () => {
  const { keys } = publicJwks();
  assert.equal(keys.length, 1);
  assert.equal(keys[0].alg, "RS256");
  assert.equal(keys[0].d, undefined);
});

test("a token with HS256, a foreign key or a changed claim is refused", () => {
  const hs = jwt.sign({ role: "SYSTEM_ADMIN" }, "secret", {
    subject: "x",
    keyid: publicJwks().keys[0].kid,
    issuer: "sc-identity",
    audience: "sc-web",
  });
  assert.throws(() => verifyActorToken(hs), /INVALID_SESSION/);
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const foreign = jwt.sign({ role: "SYSTEM_ADMIN" }, privateKey, {
    algorithm: "RS256",
    keyid: "other",
    subject: "x",
    issuer: "sc-identity",
    audience: "sc-web",
  });
  assert.throws(() => verifyActorToken(foreign), /INVALID_SESSION/);
  const [h, p, s] = signActorToken(actor).split(".");
  const forged = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(p, "base64url")),
      role: "AUDITOR",
    }),
  ).toString("base64url");
  assert.throws(
    () => verifyActorToken(`${h}.${forged}.${s}`),
    /INVALID_SESSION/,
  );
});

test("an unknown key id makes the verifier fetch JWKS_URL", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "rotated" };
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: true, data: { keys: [jwk] } }));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  process.env.JWKS_URL = `http://127.0.0.1:${server.address().port}/jwks`;
  const token = jwt.sign({ role: "AUDITOR", org: "OPS" }, privateKey, {
    algorithm: "RS256",
    keyid: "rotated",
    subject: "u2",
    issuer: "sc-identity",
    audience: "sc-web",
  });
  try {
    await refreshJwks(true);
    const { actor: back } = await verifyActorTokenAsync(token);
    assert.equal(back.id, "u2");
  } finally {
    delete process.env.JWKS_URL;
    server.closeAllConnections();
    server.close();
  }
});
