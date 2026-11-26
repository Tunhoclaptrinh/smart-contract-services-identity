import { BadRequestException, Logger } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { RecordEntity, Repository } from "@sc/nest-common";

/**
 * Secrets identity hands out besides access tokens, and the rules for passwords. Only hashes are
 * stored (SHA-256 of a 256-bit random value): a copy of the database gives no usable token.
 *
 * Collections (schema `identity`, not exposed through /resources):
 *   refresh-tokens   one row per issued refresh token; a family chains the rotations of a sign-in
 *   one-time-tokens  password reset and invitation codes (purpose, user, expiry, used)
 *   mail-outbox      messages to send (no mail server yet; logged and listed in demo mode)
 */

// ---------------------------------------------------------------- passwords

/** A short list of passwords people still pick; the full rule set is NIST SP 800-63B §5.1.1. */
const COMMON = new Set([
  "123456789012",
  "passwordpassword",
  "password1234",
  "qwertyuiopas",
  "matkhau12345",
  "abc123456789",
  "111111111111",
  "000000000000",
  "iloveyou1234",
  "admin1234567",
]);

/**
 * The problem with a new password, or null. Length 12–128 (no composition rules, per NIST); not a
 * known common password; not built on the account's own email.
 */
export function passwordProblem(
  password: unknown,
  email?: string,
): string | null {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    return "PASSWORD_MINIMUM_12_CHARACTERS";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password))
    return "PASSWORD_TOO_COMMON";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local))
    return "PASSWORD_CONTAINS_EMAIL";
  return null;
}

export function assertPassword(
  password: unknown,
  email?: string,
): asserts password is string {
  const problem = passwordProblem(password, email);
  if (problem) throw new BadRequestException(problem);
}

// ---------------------------------------------------------------- secrets

export const hashSecret = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
export const newSecret = () => randomBytes(32).toString("base64url");

const days = (n: number) => n * 24 * 60 * 60 * 1000;
export const refreshTtlMs = () =>
  days(Number(process.env.REFRESH_TTL_DAYS ?? 14));
export const RESET_TTL_MS = 30 * 60 * 1000;
export const INVITE_TTL_MS = days(7);

function row(fields: Record<string, unknown>): RecordEntity {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/** A refresh token row; the secret goes to the client, only its hash is kept. */
export function refreshRow(
  user: RecordEntity,
  familyId: string = randomUUID(),
) {
  const secret = newSecret();
  return {
    secret,
    row: row({
      organizationId: user.organizationId,
      userId: user.id,
      familyId,
      hash: hashSecret(secret),
      tokenVersion: Number(user.tokenVersion ?? 0),
      expiresAt: new Date(Date.now() + refreshTtlMs()).toISOString(),
      usedAt: null,
      revokedAt: null,
    }),
  };
}

export type OneTimePurpose = "PASSWORD_RESET" | "INVITATION";

export function oneTimeRow(
  user: RecordEntity,
  purpose: OneTimePurpose,
  ttlMs: number,
) {
  const secret = newSecret();
  return {
    secret,
    row: row({
      organizationId: user.organizationId,
      userId: user.id,
      purpose,
      hash: hashSecret(secret),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      usedAt: null,
    }),
  };
}

export const expired = (item: RecordEntity) =>
  Date.parse(String(item.expiresAt)) <= Date.now();

// ---------------------------------------------------------------- mail

const log = new Logger("Mail");
export interface Mail {
  to: string;
  subject: string;
  text: string;
  link: string;
  kind: OneTimePurpose;
}

/** Queues a message. Until a mail service exists the outbox is the delivery (demo, tests, logs). */
export async function sendMail(
  repo: Repository,
  mail: Mail,
  organizationId: unknown,
) {
  await repo.mutate("mail-outbox", (items) => {
    items.push(row({ ...mail, organizationId, status: "QUEUED" }));
    // The outbox keeps the latest 200 messages; older ones carry expired codes anyway.
    if (items.length > 200) items.splice(0, items.length - 200);
  });
  if (process.env.NODE_ENV !== "production")
    log.log(`${mail.kind} → ${mail.to}: ${mail.link}`);
}

export const webLink = (path: string) =>
  `${(process.env.WEB_ORIGIN?.split(",")[0] ?? "http://127.0.0.1:5173").replace(/\/$/, "")}${path}`;
