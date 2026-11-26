import {
  Injectable,
  Inject,
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Param,
  HttpCode,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  CanActivate,
  ExecutionContext,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  Repository,
  Public,
  RequirePermission,
  permissionsFor,
  orgAdminRefusal,
  auditContext,
  fieldProblem,
  normalizeField,
  repoRoot,
  bearerToken,
  publicJwks,
  signingKey,
  signActorToken,
  verifyActorToken,
} from "@sc/nest-common";
import type {
  Actor,
  SessionRequest,
  Role,
  RecordEntity,
} from "@sc/nest-common";
import { buildDirectory, FEATURED_ACCOUNTS } from "./seed-directory";
import {
  INVITE_TTL_MS,
  RESET_TTL_MS,
  assertPassword,
  expired,
  hashSecret,
  oneTimeRow,
  refreshRow,
  refreshTtlMs,
  sendMail,
  webLink,
  type OneTimePurpose,
} from "./credentials";
import {
  AcceptInvitationDto,
  AdminResetPasswordDto,
  ChangePasswordDto,
  DemoLoginDto,
  ForgotPasswordDto,
  InviteDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
/**
 * One-click demo sign-in: on by default in development, off in production unless DEMO_LOGIN=true.
 * Never enable it on a deployment that holds real data.
 */
export function demoLoginEnabled() {
  if (process.env.DEMO_LOGIN === "true") return true;
  if (process.env.DEMO_LOGIN === "false") return false;
  return process.env.NODE_ENV !== "production";
}
/** Self sign-up of a company; on unless SIGNUP=false. */
export function signUpEnabled() {
  return process.env.SIGNUP !== "false";
}

interface FieldRule {
  key: string;
  type: string;
  required?: boolean;
  maxLength?: number;
  options?: string[];
}

/** The organisation fields of resources.json, so sign-up checks exactly what the CRUD checks. */
const organizationFields = (): FieldRule[] => {
  const file = JSON.parse(
    readFileSync(
      resolve(repoRoot(), "packages/contracts/resources.json"),
      "utf8",
    ),
  ) as { name: string; fields: FieldRule[] }[];
  return (
    file.find((resource) => resource.name === "organizations")?.fields ?? []
  );
};

/** Failed sign-ins before an account is locked, and for how long (OWASP ASVS V2.2). */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60 * 1000;
const ROLES: Role[] = [
  "CONTRACT_OWNER",
  "FINANCE_APPROVER",
  "SECONDARY_APPROVER",
  "LEGAL_REVIEWER",
  "ADMIN_AUDITOR",
  "SYSTEM_ADMIN",
  "AUDITOR",
  "SUPPLIER",
  "ORG_ADMIN",
];
/** A hash that never matches, compared when the email is unknown so timing does not tell. */
const NO_USER_HASH = bcrypt.hashSync(randomUUID(), 10);
const emailOf = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export interface Session {
  /** Access token (kept as `token` for clients written before refresh tokens). */
  token: string;
  accessToken: string;
  refreshToken: string;
  /** Refresh token lifetime in seconds. */
  refreshExpiresIn: number;
  user: Actor;
}

@Injectable()
export class AuthService {
  constructor(@Inject(Repository) private repo: Repository) {
    signingKey(); // fails fast in production without JWT_PRIVATE_KEY
  }
  actor(record: RecordEntity): Actor {
    return {
      id: record.id,
      email: String(record.email),
      displayName: String(record.displayName),
      role: record.role as Role,
      organizationId: String(record.organizationId),
      roleChipOrganization: String(
        record.roleChipOrganization ?? record.organizationId,
      ),
      partyId: record.partyId ? String(record.partyId) : null,
      title: String(record.title ?? ""),
      permissions: permissionsFor(record.role as Role),
      active: record.active !== false,
    };
  }
  private auditEntry(
    action: string,
    user: RecordEntity | Actor,
    extra: Record<string, unknown> = {},
  ): RecordEntity {
    const now = new Date().toISOString();
    return {
      id: randomBytes(16).toString("hex"),
      version: 1,
      createdAt: now,
      updatedAt: now,
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      action,
      resource: "users",
      recordId: user.id,
      ...extra,
    };
  }
  private async recordAccess(action: string, user: RecordEntity) {
    await this.repo.mutate("audit", (entries) =>
      entries.push(this.auditEntry(action, user)),
    );
  }

  // ------------------------------------------------------------ sessions

  /** Access token plus a new refresh token (a new family unless rotating one). */
  private async session(
    user: RecordEntity,
    familyId?: string,
  ): Promise<Session> {
    const { secret, row } = refreshRow(user, familyId);
    await this.repo.mutate("refresh-tokens", (items) => {
      items.push(row);
      // Rows past their expiry are dropped as new ones come in.
      for (let i = items.length - 1; i >= 0; i--)
        if (expired(items[i]) && items[i] !== row) items.splice(i, 1);
    });
    return this.sessionWith(user, secret);
  }
  private sessionWith(user: RecordEntity, refreshToken: string): Session {
    const actor = this.actor(user);
    const accessToken = signActorToken(actor, Number(user.tokenVersion ?? 0));
    return {
      token: accessToken,
      accessToken,
      refreshToken,
      refreshExpiresIn: Math.round(refreshTtlMs() / 1000),
      user: actor,
    };
  }

  async login(body: unknown) {
    const { email, password } = (body ?? {}) as Partial<LoginDto>;
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length > 1024
    )
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    const wanted = emailOf(email);
    const user = (await this.repo.list("users")).find(
      (x) => emailOf(x.email) === wanted,
    );
    if (user && Date.parse(String(user.lockedUntil ?? "")) > Date.now())
      throw new HttpException(
        "ACCOUNT_TEMPORARILY_LOCKED",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const matches = await bcrypt.compare(
      password,
      user ? String(user.passwordHash) : NO_USER_HASH,
    );
    if (!user || !matches || user.active === false) {
      if (user && !matches) await this.countFailure(user.id);
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }
    if (user.failedLogins || user.lockedUntil)
      await this.repo.mutate("users", (items) => {
        const row = items.find((x) => x.id === user.id);
        if (row) Object.assign(row, { failedLogins: 0, lockedUntil: null });
      });
    await this.recordAccess("LOGIN", user);
    return this.session(user);
  }
  /** Counts a wrong password; the fifth within the lock window locks the account. */
  private async countFailure(id: string) {
    let locked: RecordEntity | undefined;
    await this.repo.mutate("users", (items) => {
      const user = items.find((x) => x.id === id);
      if (!user) return;
      const recent =
        Date.now() - Date.parse(String(user.lastFailedLoginAt ?? 0)) < LOCK_MS;
      const failures = (recent ? Number(user.failedLogins ?? 0) : 0) + 1;
      Object.assign(user, {
        failedLogins: failures,
        lastFailedLoginAt: new Date().toISOString(),
        ...(failures >= MAX_FAILED_LOGINS
          ? { lockedUntil: new Date(Date.now() + LOCK_MS).toISOString() }
          : {}),
      });
      if (failures === MAX_FAILED_LOGINS) locked = { ...user };
    });
    if (locked) await this.recordAccess("ACCOUNT_LOCKED", locked);
  }

  /**
   * Rotates a refresh token: the presented one is spent and a new one of the same family is
   * returned. Presenting a spent token again means it was copied: the whole family is revoked
   * (OAuth 2.0 Security BCP §4.14).
   */
  async refresh(secret: unknown) {
    if (typeof secret !== "string" || !secret)
      throw new UnauthorizedException("INVALID_REFRESH_TOKEN");
    const hash = hashSecret(secret);
    const now = new Date().toISOString();
    const outcome = await this.repo.transact(
      ["refresh-tokens", "users"],
      (tables) => {
        const row = tables["refresh-tokens"].find((x) => x.hash === hash);
        if (!row) return { error: "INVALID_REFRESH_TOKEN" } as const;
        const family = tables["refresh-tokens"].filter(
          (x) => x.familyId === row.familyId,
        );
        if (row.usedAt && !row.revokedAt) {
          for (const item of family) item.revokedAt ??= now;
          return {
            error: "REFRESH_TOKEN_REUSED",
            userId: row.userId,
            organizationId: row.organizationId,
          } as const;
        }
        if (row.revokedAt || expired(row))
          return { error: "INVALID_REFRESH_TOKEN" } as const;
        const user = tables.users.find((x) => x.id === row.userId);
        if (
          !user ||
          user.active === false ||
          Number(user.tokenVersion ?? 0) !== Number(row.tokenVersion)
        ) {
          row.revokedAt = now;
          return { error: "INVALID_REFRESH_TOKEN" } as const;
        }
        row.usedAt = now;
        const next = refreshRow(user, String(row.familyId));
        tables["refresh-tokens"].push(next.row);
        return { user: { ...user }, secret: next.secret } as const;
      },
      (result) => {
        if (!("error" in result) || result.error !== "REFRESH_TOKEN_REUSED")
          return [];
        // A copied refresh token: recorded with the account it belongs to, the system as actor.
        const entry = this.auditEntry("REFRESH_TOKEN_REUSED", {
          id: String(result.userId),
          version: 1,
          createdAt: now,
          updatedAt: now,
          organizationId: String(result.organizationId),
          displayName: "",
          role: "SYSTEM",
        });
        return [{ ...entry, actorId: "system", actorRole: "SYSTEM" }];
      },
    );
    if ("error" in outcome) throw new UnauthorizedException(outcome.error);
    return this.sessionWith(outcome.user, outcome.secret);
  }

  /** Every token of the account stops working: access tokens (version) and refresh tokens. */
  private revokeAll(
    tables: Record<string, RecordEntity[]>,
    user: RecordEntity,
  ) {
    const now = new Date().toISOString();
    user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
    for (const item of tables["refresh-tokens"])
      if (item.userId === user.id) item.revokedAt ??= now;
  }

  async logout(actor: Actor) {
    await this.repo.transact(
      ["users", "refresh-tokens"],
      (tables) => {
        const user = tables.users.find((x) => x.id === actor.id);
        if (user) this.revokeAll(tables, user);
      },
      () => [this.auditEntry("LOGOUT", actor)],
    );
    return { loggedOut: true };
  }

  // ------------------------------------------------------------ passwords

  /** The signed-in user changes its own password; other sessions end, this one is renewed. */
  async changePassword(actor: Actor, body: unknown) {
    const { currentPassword, newPassword } = (body ??
      {}) as Partial<ChangePasswordDto>;
    const user = (await this.repo.list("users")).find((x) => x.id === actor.id);
    if (!user) throw new UnauthorizedException("INVALID_SESSION");
    if (
      typeof currentPassword !== "string" ||
      !(await bcrypt.compare(currentPassword, String(user.passwordHash)))
    )
      throw new BadRequestException("CURRENT_PASSWORD_INCORRECT");
    assertPassword(newPassword, String(user.email));
    if (await bcrypt.compare(newPassword, String(user.passwordHash)))
      throw new BadRequestException("PASSWORD_UNCHANGED");
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await this.repo.transact(
      ["users", "refresh-tokens"],
      (tables) => {
        const row = tables.users.find((x) => x.id === actor.id)!;
        row.passwordHash = passwordHash;
        row.passwordChangedAt = new Date().toISOString();
        this.revokeAll(tables, row);
        row.version++;
        return { ...row };
      },
      () => [this.auditEntry("PASSWORD_CHANGED", actor)],
    );
    return this.session(updated);
  }

  /**
   * Starts a password reset. The answer is the same whether or not the email has an account, so
   * the endpoint does not tell which emails exist (OWASP Forgot Password Cheat Sheet).
   */
  async forgotPassword(body: unknown) {
    const email = emailOf((body as Partial<ForgotPasswordDto>)?.email);
    const user = (await this.repo.list("users")).find(
      (x) => emailOf(x.email) === email && x.active !== false,
    );
    if (user) {
      const { secret, row } = oneTimeRow(user, "PASSWORD_RESET", RESET_TTL_MS);
      await this.repo.transact(
        ["one-time-tokens"],
        (tables) => {
          // Only the newest reset code of an account works.
          for (const item of tables["one-time-tokens"])
            if (item.userId === user.id && item.purpose === "PASSWORD_RESET")
              item.usedAt ??= new Date().toISOString();
          tables["one-time-tokens"].push(row);
        },
        [this.auditEntry("PASSWORD_RESET_REQUESTED", user)],
      );
      await sendMail(
        this.repo,
        {
          to: String(user.email),
          subject: "Đặt lại mật khẩu",
          text: "Mã có hiệu lực 30 phút. Bỏ qua thư này nếu bạn không yêu cầu.",
          link: webLink(`/reset-password?token=${secret}`),
          kind: "PASSWORD_RESET",
        },
        user.organizationId,
      );
    }
    return { accepted: true };
  }

  /** A valid, unused, unexpired code of this purpose, or the error code to answer with. */
  private findCode(
    tables: Record<string, RecordEntity[]>,
    secret: unknown,
    purpose: OneTimePurpose,
  ) {
    if (typeof secret !== "string" || !secret) return undefined;
    const hash = hashSecret(secret);
    const row = tables["one-time-tokens"].find(
      (x) => x.hash === hash && x.purpose === purpose,
    );
    return row && !row.usedAt && !expired(row) ? row : undefined;
  }

  async resetPasswordWithToken(body: unknown) {
    const { token, newPassword } = (body ?? {}) as Partial<ResetPasswordDto>;
    const passwordHash =
      typeof newPassword === "string" ? await bcrypt.hash(newPassword, 12) : "";
    const user = await this.repo.transact(
      ["one-time-tokens", "users", "refresh-tokens"],
      (tables) => {
        const code = this.findCode(tables, token, "PASSWORD_RESET");
        const user = code && tables.users.find((x) => x.id === code.userId);
        if (!code || !user || user.active === false)
          throw new BadRequestException("INVALID_OR_EXPIRED_TOKEN");
        assertPassword(newPassword, String(user.email));
        code.usedAt = new Date().toISOString();
        Object.assign(user, {
          passwordHash,
          passwordChangedAt: code.usedAt,
          failedLogins: 0,
          lockedUntil: null,
        });
        this.revokeAll(tables, user);
        user.version++;
        return { ...user };
      },
      (user) => [this.auditEntry("PASSWORD_RESET", user)],
    );
    return { reset: true, email: user.email };
  }

  /** An administrator sets a password for an account it manages. */
  async resetPassword(id: string, password: unknown, actor: Actor) {
    assertPassword(password);
    const passwordHash = await bcrypt.hash(password, 12);
    const tables = {
      organizations: await this.repo.list("organizations"),
      parties: await this.repo.list("parties"),
    };
    await this.repo.transact(
      ["users", "refresh-tokens"],
      (all) => {
        const user = all.users.find(
          (x) =>
            x.id === id &&
            (actor.role !== "ORG_ADMIN" ||
              x.organizationId === actor.organizationId),
        );
        if (!user) throw new NotFoundException("USER_NOT_FOUND");
        // A company administrator resets only the accounts it may manage (never a controller's).
        const refusal = orgAdminRefusal(actor, user, tables);
        if (refusal) throw new ForbiddenException(refusal);
        Object.assign(user, {
          passwordHash,
          failedLogins: 0,
          lockedUntil: null,
          updatedAt: new Date().toISOString(),
        });
        this.revokeAll(all, user);
        user.version++;
      },
      [{ ...this.auditEntry("RESET_PASSWORD", actor), recordId: id }],
    );
    return { updated: true };
  }

  // ------------------------------------------------------------ invitations

  /**
   * An administrator invites a person: the account exists at once (INVITED, inactive) and the
   * person activates it by choosing a password through the emailed link. A company administrator
   * invites only into its company and only the roles it may assign (SoD).
   */
  async invite(actor: Actor, body: unknown) {
    const input = (body ?? {}) as Partial<InviteDto>;
    const email = emailOf(input.email);
    const displayName =
      typeof input.displayName === "string" ? input.displayName.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException("INVALID_EMAIL");
    if (!displayName) throw new BadRequestException("REQUIRED:displayName");
    if (!ROLES.includes(input.role as Role))
      throw new BadRequestException("INVALID_OPTION:role");
    const organizations = await this.repo.list("organizations");
    const organizationId =
      actor.role === "SYSTEM_ADMIN"
        ? String(input.organizationId ?? "")
        : actor.organizationId;
    if (!organizationId)
      throw new BadRequestException("REQUIRED:organizationId");
    const organization = organizations.find((x) => x.id === organizationId);
    if (!organization) throw new NotFoundException("ORGANIZATION_NOT_FOUND");
    const account = { role: input.role, organizationId, partyId: null };
    const refusal = orgAdminRefusal(actor, account, {
      organizations,
      parties: await this.repo.list("parties"),
    });
    if (refusal) throw new ForbiddenException(refusal);
    if (actor.role !== "SYSTEM_ADMIN" && actor.role !== "ORG_ADMIN")
      throw new ForbiddenException("PERMISSION_DENIED");
    const now = new Date().toISOString();
    const placeholder = await bcrypt.hash(randomUUID(), 10);
    const result = await this.repo.transact(
      ["users", "one-time-tokens"],
      (tables) => {
        let user = tables.users.find((x) => emailOf(x.email) === email);
        if (user && user.status !== "INVITED")
          throw new ConflictException("EMAIL_TAKEN");
        if (!user) {
          user = {
            id: randomUUID(),
            version: 1,
            createdAt: now,
            updatedAt: now,
            email,
            displayName,
            title: typeof input.title === "string" ? input.title.trim() : "",
            role: input.role,
            organizationId,
            roleChipOrganization: String(organization.name),
            partyId: null,
            origin: "APP",
            status: "INVITED",
            active: false,
            invitedBy: actor.id,
            passwordHash: placeholder,
          };
          tables.users.push(user);
        }
        // Inviting again re-sends: earlier codes stop working.
        for (const item of tables["one-time-tokens"])
          if (item.userId === user.id && item.purpose === "INVITATION")
            item.usedAt ??= now;
        const code = oneTimeRow(user, "INVITATION", INVITE_TTL_MS);
        tables["one-time-tokens"].push(code.row);
        return {
          user: { ...user },
          secret: code.secret,
          expiresAt: code.row.expiresAt,
        };
      },
      (result) => [
        { ...this.auditEntry("INVITE", actor), recordId: result.user.id },
      ],
    );
    await sendMail(
      this.repo,
      {
        to: email,
        subject: `Lời mời tham gia ${String(organization.name)}`,
        text: `${actor.displayName} mời bạn vào hệ thống. Lời mời có hiệu lực 7 ngày.`,
        link: webLink(`/accept-invitation?token=${result.secret}`),
        kind: "INVITATION",
      },
      organizationId,
    );
    return {
      userId: result.user.id,
      email,
      status: "INVITED",
      expiresAt: result.expiresAt,
    };
  }

  /** What the invitation page shows before the person chooses a password. */
  async invitation(secret: string) {
    const tables = {
      "one-time-tokens": await this.repo.list("one-time-tokens"),
    };
    const code = this.findCode(tables, secret, "INVITATION");
    const user =
      code && (await this.repo.list("users")).find((x) => x.id === code.userId);
    if (!code || !user || user.status !== "INVITED")
      throw new NotFoundException("INVITATION_NOT_FOUND");
    return {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      organization: user.roleChipOrganization,
      expiresAt: code.expiresAt,
    };
  }

  async acceptInvitation(body: unknown) {
    const { token, password, displayName } = (body ??
      {}) as Partial<AcceptInvitationDto>;
    const passwordHash =
      typeof password === "string" ? await bcrypt.hash(password, 12) : "";
    const user = await this.repo.transact(
      ["one-time-tokens", "users"],
      (tables) => {
        const code = this.findCode(tables, token, "INVITATION");
        const user = code && tables.users.find((x) => x.id === code.userId);
        if (!code || !user || user.status !== "INVITED")
          throw new NotFoundException("INVITATION_NOT_FOUND");
        assertPassword(password, String(user.email));
        code.usedAt = new Date().toISOString();
        Object.assign(user, {
          passwordHash,
          status: "ACTIVE",
          active: true,
          activatedAt: code.usedAt,
          ...(typeof displayName === "string" && displayName.trim()
            ? { displayName: displayName.trim() }
            : {}),
          version: user.version + 1,
          updatedAt: code.usedAt,
        });
        return { ...user };
      },
      (user) => [this.auditEntry("INVITATION_ACCEPTED", user)],
    );
    return this.session(user);
  }

  /** Demo deployments: the latest queued messages, so a reset or an invitation can be followed. */
  async outbox() {
    if (!demoLoginEnabled()) throw new NotFoundException("OUTBOX_DISABLED");
    return (await this.repo.list("mail-outbox"))
      .slice(-20)
      .reverse()
      .map(({ to, subject, link, kind, createdAt }) => ({
        to,
        subject,
        link,
        kind,
        createdAt,
      }));
  }

  // ------------------------------------------------------------ demo, sign-up, seed

  /** Seeded accounts: the featured ones first, then every organisation of the Data Pack. */
  async demoAccounts() {
    if (!demoLoginEnabled())
      return { enabled: false, accounts: [], organizations: [] };
    const users = (await this.repo.list("users")).filter(
      (u) => u.origin === "SEED" && u.active !== false,
    );
    // Contract codes of each organisation, drafts included, so the demo menu finds "who acts on CT0105".
    const contractsOf = new Map<string, Set<string>>();
    const link = (party: unknown, code: unknown) => {
      if (!party || !code) return;
      const codes = contractsOf.get(String(party)) ?? new Set<string>();
      codes.add(String(code));
      contractsOf.set(String(party), codes);
    };
    for (const c of await this.repo.list("contracts")) {
      link(c.buyer_id, c.contract_id);
      link(c.supplier_id, c.contract_id);
    }
    for (const d of await this.repo.list("contract-drafts")) {
      link(d.organizationId, d.code);
      link(d.supplierId, d.code);
    }
    const view = (u: RecordEntity) => ({
      email: String(u.email),
      displayName: String(u.displayName),
      role: u.role as Role,
      organization: String(u.roleChipOrganization ?? ""),
      organizationId: String(u.organizationId),
      partyId: u.partyId ? String(u.partyId) : null,
      contracts: [...(contractsOf.get(String(u.organizationId)) ?? [])],
    });
    const groups = new Map<string, ReturnType<typeof view>[]>();
    for (const user of users) {
      if (FEATURED_ACCOUNTS.includes(user.id)) continue;
      const list = groups.get(String(user.organizationId)) ?? [];
      list.push(view(user));
      groups.set(String(user.organizationId), list);
    }
    return {
      enabled: true,
      accounts: FEATURED_ACCOUNTS.map((id) => users.find((u) => u.id === id))
        .filter((u): u is RecordEntity => !!u)
        .map(view),
      organizations: [...groups]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, accounts]) => ({
          id,
          name: accounts[0].organization,
          accounts,
        })),
    };
  }
  async demoLogin(body: unknown) {
    if (!demoLoginEnabled()) throw new NotFoundException("DEMO_LOGIN_DISABLED");
    const email = emailOf((body as Partial<DemoLoginDto>)?.email);
    const user = (await this.repo.list("users")).find(
      (x) =>
        x.origin === "SEED" && emailOf(x.email) === email && x.active !== false,
    );
    if (!user) throw new UnauthorizedException("INVALID_CREDENTIALS");
    await this.recordAccess("LOGIN_DEMO", user);
    return this.session(user);
  }
  /** Identity also checks the account: still active and the token not revoked (`tv`). */
  async authenticate(token: string) {
    const { actor, tokenVersion } = verifyActorToken(token);
    const user = (await this.repo.list("users")).find((x) => x.id === actor.id);
    if (
      !user ||
      user.active === false ||
      tokenVersion !== Number(user.tokenVersion ?? 0)
    )
      throw new UnauthorizedException("INVALID_SESSION");
    return this.actor(user);
  }
  /**
   * Self sign-up: a company and its account administrator (ORG_ADMIN), who then invites the
   * company's business accounts. Nobody signs up into an existing company or into a controller
   * or platform role, so segregation of duties holds. Returns a session like sign-in.
   */
  async register(body: unknown) {
    if (!signUpEnabled()) throw new NotFoundException("SIGNUP_DISABLED");
    const input = (body && typeof body === "object" ? body : {}) as {
      organization?: Record<string, unknown>;
      admin?: Record<string, unknown>;
    };
    const org = input.organization ?? {};
    const admin = input.admin ?? {};
    const organization: Record<string, unknown> = {};
    for (const field of organizationFields()) {
      const problem = fieldProblem(field as never, org[field.key]);
      if (problem) throw new BadRequestException(problem);
      const value = normalizeField(field as never, org[field.key]);
      if (value !== undefined && value !== "") organization[field.key] = value;
    }
    if (!["BUYER", "SUPPLIER"].includes(String(organization.kind)))
      throw new BadRequestException("INVALID_ORGANIZATION_KIND");
    const displayName =
      typeof admin.displayName === "string" ? admin.displayName.trim() : "";
    const email = emailOf(admin.email);
    const password = admin.password;
    if (!displayName || displayName.length > 250)
      throw new BadRequestException("REQUIRED:displayName");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new BadRequestException("INVALID_EMAIL");
    assertPassword(password, email);
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const orgId = randomUUID();
    const user: RecordEntity = {
      id: randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      email,
      displayName,
      title: "Quản trị tài khoản công ty",
      role: "ORG_ADMIN",
      organizationId: orgId,
      roleChipOrganization: String(organization.name),
      partyId: null,
      origin: "APP",
      status: "ACTIVE",
      active: true,
      passwordHash,
    };
    await this.repo.transact(
      ["organizations", "users"],
      (tables) => {
        if (
          tables.organizations.some(
            (item) =>
              String(item.code).toLowerCase() ===
              String(organization.code).toLowerCase(),
          )
        )
          throw new ConflictException("ORGANIZATION_CODE_TAKEN");
        if (tables.users.some((item) => emailOf(item.email) === email))
          throw new ConflictException("EMAIL_TAKEN");
        tables.organizations.push({
          ...organization,
          id: orgId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          organizationId: orgId,
          origin: "APP",
        });
        tables.users.push(user);
      },
      [
        {
          ...this.auditEntry("REGISTER", user),
          resource: "organizations",
          recordId: orgId,
        },
      ],
    );
    return this.session(user);
  }
  /**
   * Creates the seed organisations and accounts of buildDirectory. Existing passwords are kept.
   */
  async seed() {
    const { organizations, accounts } = buildDirectory();
    const stamp = new Date().toISOString();
    await this.repo.mutate("organizations", (items) => {
      for (const org of organizations)
        if (!items.some((item) => item.id === org.id))
          items.push({
            ...org,
            version: 1,
            createdAt: stamp,
            updatedAt: stamp,
          });
    });
    const passwordHash = await bcrypt.hash(
      process.env.SEED_PASSWORD ?? "Passw0rd!",
      12,
    );
    const now = new Date().toISOString();
    await this.repo.mutate("users", (items) => {
      const kept = new Set<RecordEntity>();
      for (const account of accounts) {
        const fields = {
          email: account.email,
          displayName: account.displayName,
          title: account.title,
          role: account.role,
          organizationId: account.organizationId,
          roleChipOrganization: account.organizationName,
          partyId: account.partyId,
          origin: account.origin,
        };
        const existing = items.find(
          (u) =>
            u.id === account.id ||
            String(u.email).toLowerCase() === account.email,
        );
        if (existing) kept.add(existing);
        if (existing && existing.partyId !== undefined) continue;
        if (existing)
          Object.assign(existing, fields, {
            version: existing.version + 1,
            updatedAt: now,
          });
        else {
          const created: RecordEntity = {
            id: account.id,
            ...fields,
            passwordHash,
            active: true,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
          items.push(created);
          kept.add(created);
        }
      }
      // Seeded accounts the directory no longer has (the platform controllers that once decided
      // exceptions on every contract) are switched off, never deleted: audit entries name them.
      for (const user of items)
        if (user.origin === "SEED" && user.active !== false && !kept.has(user))
          Object.assign(user, {
            active: false,
            version: user.version + 1,
            updatedAt: now,
          });
    });
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AuthService) private auth: AuthService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride("public", [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest();
    req.user = await this.auth.authenticate(
      bearerToken(req.headers.authorization),
    );
    const context = auditContext.getStore();
    if (context) context.actor = req.user;
    return true;
  }
}

/** Public keys of the access tokens, for the gateway and the other services (JWKS_URL). */
@ApiTags("auth")
@Controller(".well-known")
export class JwksController {
  @Public() @Get("jwks.json") jwks() {
    return publicJwks();
  }
}

/**
 * The refresh token also travels as an httpOnly cookie scoped to /api/v1/auth, so the web never
 * needs to keep it in script-readable storage; API clients (Postman) use the body field.
 */
const REFRESH_COOKIE = "sc_refresh";
interface CookieResponse {
  setHeader(name: string, value: string): void;
}
function setRefreshCookie(res: CookieResponse, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${REFRESH_COOKIE}=${value}; Path=/api/v1/auth; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`,
  );
}
function cookieValue(header: unknown, name: string) {
  if (typeof header !== "string") return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}
const withCookie = async (res: CookieResponse, session: Promise<Session>) => {
  const value = await session;
  setRefreshCookie(res, value.refreshToken, value.refreshExpiresIn);
  return value;
};

/** Sign-in, sign-up and password routes are limited per client address (AUTH_RATE_LIMIT/min). */
const SENSITIVE = {
  default: { limit: Number(process.env.AUTH_RATE_LIMIT ?? 10), ttl: 60_000 },
};

@ApiTags("auth")
@ApiBearerAuth()
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(Repository) private repo: Repository,
  ) {}
  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("login")
  login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    return withCookie(res, this.auth.login(body));
  }
  @Public()
  @Throttle(SENSITIVE)
  @Post("register")
  register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    return withCookie(res, this.auth.register(body));
  }
  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("refresh")
  refresh(
    @Body() body: RefreshDto,
    @Req() req: { headers: Record<string, unknown> },
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const secret =
      body?.refreshToken ?? cookieValue(req.headers.cookie, REFRESH_COOKIE);
    return withCookie(res, this.auth.refresh(secret));
  }
  @Public() @Get("demo-accounts") demoAccounts() {
    return this.auth.demoAccounts();
  }
  @Public()
  @HttpCode(200)
  @Post("demo-login")
  demoLogin(
    @Body() body: DemoLoginDto,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    return withCookie(res, this.auth.demoLogin(body));
  }
  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(202)
  @Post("forgot-password")
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body);
  }
  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("reset-password")
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPasswordWithToken(body);
  }
  @Public()
  @Throttle(SENSITIVE)
  @Get("invitations/:token")
  invitation(@Param("token") token: string) {
    return this.auth.invitation(token);
  }
  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(200)
  @Post("invitations/accept")
  acceptInvitation(
    @Body() body: AcceptInvitationDto,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    return withCookie(res, this.auth.acceptInvitation(body));
  }
  @RequirePermission("users:create")
  @Post("invitations")
  invite(@Body() body: InviteDto, @Req() req: SessionRequest) {
    return this.auth.invite(req.user, body);
  }
  /** Demo deployments only: messages that would have been emailed (reset codes, invitations). */
  @Public() @Get("outbox") outbox() {
    return this.auth.outbox();
  }
  /** Demo deployments only, system administrator only; the previous data is archived, not deleted. */
  @RequirePermission("demo:reset")
  @HttpCode(200)
  @Post("reset-demo")
  async resetDemo(@Req() req: SessionRequest) {
    if (!demoLoginEnabled()) throw new NotFoundException("DEMO_LOGIN_DISABLED");
    const archived = await this.repo.archiveAndReset();
    const now = new Date().toISOString();
    // First entry of the new chain: it links to the archived head (audit-chain chainOrigin).
    await this.repo.transact([], () => null, [
      {
        id: `demo-reset-${archived.archive}`,
        version: 1,
        createdAt: now,
        updatedAt: now,
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "RESET_DEMO_DATA",
        resource: "datapack",
        recordId: archived.archive,
        archivedEntries: archived.entries,
        archivedHeadHash:
          typeof archived.head?.hash === "string" ? archived.head.hash : null,
      },
    ]);
    await this.auth.seed();
    return { archive: archived.archive };
  }
  @HttpCode(200)
  @Post("logout")
  async logout(
    @Req() req: SessionRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    setRefreshCookie(res, "", 0);
    return this.auth.logout(req.user);
  }
  @Get("me") me(@Req() req: SessionRequest) {
    return req.user;
  }
  @HttpCode(200)
  @Post("password")
  changePassword(
    @Body() body: ChangePasswordDto,
    @Req() req: SessionRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    return withCookie(res, this.auth.changePassword(req.user, body));
  }
  @RequirePermission("users:reset-password")
  @HttpCode(200)
  @Post("users/:id/password")
  reset(
    @Param("id") id: string,
    @Body() body: AdminResetPasswordDto,
    @Req() req: SessionRequest,
  ) {
    return this.auth.resetPassword(id, body?.password, req.user);
  }
}
