// Refresh tokens, lockout, password change and reset, invitations (AuthService directly).
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Repository } from "@sc/nest-common";
import { AuthService, MAX_FAILED_LOGINS } from "../dist/auth.js";
import { passwordProblem } from "../dist/credentials.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const PASSWORD = "MotMatKhauDai2026!";
let repo, auth, dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "btl-flows-"));
  Object.assign(process.env, {
    DATA_DIR: dir,
    STORAGE_DRIVER: "file",
    REPO_ROOT: repoRoot,
  });
  delete process.env.SIGNUP;
  repo = new Repository();
  await repo.init();
  auth = new AuthService(repo);
  await auth.seed();
});
afterEach(async () => {
  await repo.onModuleDestroy();
  await rm(dir, { recursive: true, force: true });
});

const signUp = (kind = "BUYER") =>
  auth.register({
    organization: { name: "Công ty Nova", code: "NOVA1", kind },
    admin: {
      displayName: "Quản trị Nova",
      email: "admin@nova.vn",
      password: PASSWORD,
    },
  });
const lastMail = async () => (await repo.list("mail-outbox")).at(-1);
const codeOf = (mail) => new URL(mail.link).searchParams.get("token");
const rejectsWith = (promise, code) =>
  assert.rejects(promise, (e) => {
    assert.equal(e.message, code);
    return true;
  });

test("password policy: length, common passwords, own email", () => {
  assert.equal(passwordProblem("short"), "PASSWORD_MINIMUM_12_CHARACTERS");
  assert.equal(passwordProblem("password1234"), "PASSWORD_TOO_COMMON");
  assert.equal(passwordProblem("aaaaaaaaaaaaaa"), "PASSWORD_TOO_COMMON");
  assert.equal(
    passwordProblem("nguyenvana-2026!", "nguyenvana@x.vn"),
    "PASSWORD_CONTAINS_EMAIL",
  );
  assert.equal(passwordProblem(PASSWORD, "a@x.vn"), null);
});

test("sign-in returns an access and a refresh token; only the hash is stored", async () => {
  const session = await signUp();
  assert.ok(session.accessToken && session.refreshToken);
  assert.equal(session.token, session.accessToken);
  const rows = await repo.list("refresh-tokens");
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].hash, session.refreshToken);
  assert.equal(JSON.stringify(rows).includes(session.refreshToken), false);
});

test("refresh rotates the token; replaying a spent one revokes the family", async () => {
  const first = await signUp();
  const second = await auth.refresh(first.refreshToken);
  assert.notEqual(second.refreshToken, first.refreshToken);
  assert.ok((await auth.authenticate(second.accessToken)).id);
  await rejectsWith(auth.refresh(first.refreshToken), "REFRESH_TOKEN_REUSED");
  // The thief's replay also cut the legitimate chain.
  await rejectsWith(auth.refresh(second.refreshToken), "INVALID_REFRESH_TOKEN");
  assert.equal(
    (await repo.list("audit")).at(-1).action,
    "REFRESH_TOKEN_REUSED",
  );
  await rejectsWith(auth.refresh("made-up"), "INVALID_REFRESH_TOKEN");
});

test("logout ends access and refresh tokens", async () => {
  const session = await signUp();
  await auth.logout(session.user);
  await rejectsWith(auth.authenticate(session.accessToken), "INVALID_SESSION");
  await rejectsWith(
    auth.refresh(session.refreshToken),
    "INVALID_REFRESH_TOKEN",
  );
});

test("five wrong passwords lock the account for a while, even for the right one", async () => {
  await signUp();
  for (let i = 0; i < MAX_FAILED_LOGINS; i++)
    await rejectsWith(
      auth.login({ email: "admin@nova.vn", password: "sai-mat-khau-123" }),
      "INVALID_CREDENTIALS",
    );
  await assert.rejects(
    auth.login({ email: "admin@nova.vn", password: PASSWORD }),
    (e) => e.getStatus() === 429 && e.message === "ACCOUNT_TEMPORARILY_LOCKED",
  );
  assert.ok(
    (await repo.list("audit")).some((e) => e.action === "ACCOUNT_LOCKED"),
  );
  // An unknown email gets the same answer as a wrong password.
  await rejectsWith(
    auth.login({ email: "ghost@nova.vn", password: PASSWORD }),
    "INVALID_CREDENTIALS",
  );
});

test("changing the password needs the current one and ends other sessions", async () => {
  const session = await signUp();
  await rejectsWith(
    auth.changePassword(session.user, {
      currentPassword: "wrong",
      newPassword: "MatKhauMoi-2026-xyz",
    }),
    "CURRENT_PASSWORD_INCORRECT",
  );
  await rejectsWith(
    auth.changePassword(session.user, {
      currentPassword: PASSWORD,
      newPassword: PASSWORD,
    }),
    "PASSWORD_UNCHANGED",
  );
  const renewed = await auth.changePassword(session.user, {
    currentPassword: PASSWORD,
    newPassword: "MatKhauMoi-2026-xyz",
  });
  await rejectsWith(auth.authenticate(session.accessToken), "INVALID_SESSION");
  assert.ok(await auth.authenticate(renewed.accessToken));
  assert.ok(
    await auth.login({
      email: "admin@nova.vn",
      password: "MatKhauMoi-2026-xyz",
    }),
  );
});

test("forgot password answers the same for unknown emails and mails a one-time code", async () => {
  await signUp();
  assert.deepEqual(await auth.forgotPassword({ email: "ghost@nova.vn" }), {
    accepted: true,
  });
  assert.equal((await repo.list("mail-outbox")).length, 0);
  await auth.forgotPassword({ email: "ADMIN@nova.vn" });
  const first = codeOf(await lastMail());
  await auth.forgotPassword({ email: "admin@nova.vn" });
  const mail = await lastMail();
  assert.equal(mail.kind, "PASSWORD_RESET");
  const code = codeOf(mail);
  // Only the newest code works, and only once.
  await rejectsWith(
    auth.resetPasswordWithToken({
      token: first,
      newPassword: "MatKhauMoi-2026-xyz",
    }),
    "INVALID_OR_EXPIRED_TOKEN",
  );
  await rejectsWith(
    auth.resetPasswordWithToken({ token: code, newPassword: "short" }),
    "PASSWORD_MINIMUM_12_CHARACTERS",
  );
  assert.deepEqual(
    await auth.resetPasswordWithToken({
      token: code,
      newPassword: "MatKhauMoi-2026-xyz",
    }),
    { reset: true, email: "admin@nova.vn" },
  );
  await rejectsWith(
    auth.resetPasswordWithToken({
      token: code,
      newPassword: "MatKhauKhac-2026-xyz",
    }),
    "INVALID_OR_EXPIRED_TOKEN",
  );
  assert.ok(
    await auth.login({
      email: "admin@nova.vn",
      password: "MatKhauMoi-2026-xyz",
    }),
  );
});

test("a company administrator invites an assignable role; the person activates it", async () => {
  const admin = (await signUp("BUYER")).user;
  await rejectsWith(
    auth.invite(admin, {
      email: "kt@nova.vn",
      displayName: "KT",
      role: "AUDITOR",
    }),
    "ROLE_NOT_ASSIGNABLE",
  );
  await rejectsWith(
    auth.invite(admin, {
      email: "admin@nova.vn",
      displayName: "X",
      role: "CONTRACT_OWNER",
    }),
    "EMAIL_TAKEN",
  );
  const invited = await auth.invite(admin, {
    email: "chu.hd@nova.vn",
    displayName: "Chủ hợp đồng",
    role: "CONTRACT_OWNER",
    organizationId: "somebody-else", // ignored: a company administrator invites into its own
  });
  assert.equal(invited.status, "INVITED");
  const user = (await repo.list("users")).find((u) => u.id === invited.userId);
  assert.equal(user.organizationId, admin.organizationId);
  assert.equal(user.active, false);
  // Not usable before activation.
  await rejectsWith(
    auth.login({ email: "chu.hd@nova.vn", password: PASSWORD }),
    "INVALID_CREDENTIALS",
  );
  const code = codeOf(await lastMail());
  const preview = await auth.invitation(code);
  assert.equal(preview.organization, "Công ty Nova");
  const session = await auth.acceptInvitation({
    token: code,
    password: PASSWORD,
  });
  assert.equal(session.user.role, "CONTRACT_OWNER");
  await rejectsWith(auth.invitation(code), "INVITATION_NOT_FOUND");
  await rejectsWith(
    auth.acceptInvitation({ token: code, password: PASSWORD }),
    "INVITATION_NOT_FOUND",
  );
});

test("a system administrator invites into a named organisation", async () => {
  const sys = (
    await auth.login({ email: "sysadmin@codecash.vn", password: "Passw0rd!" })
  ).user;
  await rejectsWith(
    auth.invite(sys, { email: "a@x.vn", displayName: "A", role: "AUDITOR" }),
    "REQUIRED:organizationId",
  );
  await rejectsWith(
    auth.invite(sys, {
      email: "a@x.vn",
      displayName: "A",
      role: "AUDITOR",
      organizationId: "nope",
    }),
    "ORGANIZATION_NOT_FOUND",
  );
  const invited = await auth.invite(sys, {
    email: "kiemtoan@codecash.vn",
    displayName: "Kiểm toán",
    role: "AUDITOR",
    organizationId: "OPS",
  });
  assert.equal(invited.email, "kiemtoan@codecash.vn");
});
