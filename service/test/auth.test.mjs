import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Repository, BaseService, verifyActorToken } from "@sc/nest-common";
import { AuthService } from "../dist/auth.js";

// The repository root (packages/contracts lives there), whatever directory the test runs from.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

let repo, auth, service, dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "btl-auth-"));
  Object.assign(process.env, {
    DATA_DIR: dir,
    STORAGE_DRIVER: "file",
    REPO_ROOT: repoRoot,
  });
  delete process.env.SIGNUP;
  repo = new Repository();
  await repo.init();
  auth = new AuthService(repo);
  service = new BaseService(repo);
  await auth.seed();
});
afterEach(async () => {
  await repo.onModuleDestroy();
  await rm(dir, { recursive: true, force: true });
});

const signUp = (fields = {}, admin = {}) =>
  auth.register({
    organization: {
      name: "Công ty Minh Long",
      code: "ML01",
      kind: "SUPPLIER",
      email: "lienhe@minhlong.vn",
      ...fields,
    },
    admin: {
      displayName: "Trần Văn Long",
      email: "long@minhlong.vn",
      password: "MotMatKhauDai2026!",
      ...admin,
    },
  });

test("a company signs up with its account administrator and is signed in", async () => {
  const session = await signUp();
  assert.ok(session.token);
  assert.equal(session.user.role, "ORG_ADMIN");
  assert.equal(session.user.roleChipOrganization, "Công ty Minh Long");
  // The token works, and the password is stored only as a hash.
  const actor = await auth.authenticate(session.token);
  assert.equal(actor.email, "long@minhlong.vn");
  const stored = (await repo.list("users")).find((u) => u.id === actor.id);
  assert.notEqual(stored.passwordHash, "MotMatKhauDai2026!");
  // The company exists, scoped to itself, and the sign-up is in the audit chain.
  const org = (await repo.list("organizations")).find((o) => o.code === "ML01");
  assert.equal(org.id, actor.organizationId);
  assert.equal(org.kind, "SUPPLIER");
  const entry = (await repo.list("audit")).find((a) => a.action === "REGISTER");
  assert.equal(entry.recordId, org.id);
  assert.ok(entry.hash && entry.prevHash);
  // A second sign-in with the chosen password works.
  const again = await auth.login({
    email: "LONG@minhlong.vn",
    password: "MotMatKhauDai2026!",
  });
  assert.equal(again.user.id, actor.id);
});

test("sign-up refuses taken emails and codes, platform kinds and weak input", async () => {
  await signUp();
  const before = (await repo.list("users")).length;
  for (const [fields, admin, code] of [
    [{ code: "ML02" }, { email: "long@minhlong.vn" }, /EMAIL_TAKEN/],
    [
      { code: "ml01" },
      { email: "khac@minhlong.vn" },
      /ORGANIZATION_CODE_TAKEN/,
    ],
    [
      { code: "ML03", kind: "INTERNAL" },
      { email: "a@b.vn" },
      /INVALID_ORGANIZATION_KIND/,
    ],
    [{ code: "ML04", name: "" }, { email: "c@d.vn" }, /REQUIRED:name/],
    [{ code: "ML05" }, { email: "khong-phai-email" }, /INVALID_EMAIL/],
    [
      { code: "ML06" },
      { email: "e@f.vn", password: "ngan" },
      /PASSWORD_MINIMUM_12/,
    ],
    [
      { code: "ML07" },
      { email: "g@h.vn", displayName: " " },
      /REQUIRED:displayName/,
    ],
  ])
    await assert.rejects(signUp(fields, admin), code);
  // A seed account's email is taken too.
  await assert.rejects(
    signUp({ code: "ML08" }, { email: "owner@novaan.vn" }),
    /EMAIL_TAKEN/,
  );
  assert.equal((await repo.list("users")).length, before);
});

test("sign-up can be switched off", async () => {
  process.env.SIGNUP = "false";
  await assert.rejects(signUp(), /SIGNUP_DISABLED/);
});

test("the new administrator creates its own company's business accounts only", async () => {
  const session = await signUp();
  const admin = await auth.authenticate(session.token);
  const created = await service.create(
    "users",
    {
      displayName: "Lê Thị Hoa",
      email: "hoa@minhlong.vn",
      role: "SUPPLIER",
      organizationId: admin.organizationId,
    },
    admin,
  );
  assert.equal(created.organizationId, admin.organizationId);
  await assert.rejects(
    service.create(
      "users",
      {
        displayName: "Kiểm soát",
        email: "ks@minhlong.vn",
        role: "ADMIN_AUDITOR",
        organizationId: admin.organizationId,
      },
      admin,
    ),
    /ROLE_NOT_ASSIGNABLE/,
  );
  const users = await service.list("users", { limit: 100 }, admin);
  assert.ok(
    users.items.every((u) => u.organizationId === admin.organizationId),
  );
});

test("the session token carries the actor, so other services need not call identity", async () => {
  const session = await signUp();
  const { actor, tokenVersion } = verifyActorToken(session.token);
  assert.equal(actor.id, session.user.id);
  assert.equal(actor.role, "ORG_ADMIN");
  assert.equal(actor.organizationId, session.user.organizationId);
  assert.equal(tokenVersion, 0);
  assert.ok(actor.permissions.length > 0);
});
