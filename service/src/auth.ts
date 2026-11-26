import {
  Injectable,
  Inject,
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  CanActivate,
  ExecutionContext,
} from "@nestjs/common";
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
  async login(body: unknown) {
    if (!body || typeof body !== "object")
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    const { email, password } = body as Record<string, unknown>;
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length > 1024
    )
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    const user = (await this.repo.list("users")).find(
      (x) => String(x.email).toLowerCase() === email.trim().toLowerCase(),
    );
    if (
      !user ||
      user.active === false ||
      !(await bcrypt.compare(password, String(user.passwordHash)))
    )
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    await this.recordAccess("LOGIN", user);
    return this.session(user);
  }
  /** Other services read the actor from the token's claims (JwtAuthGuard in the chassis). */
  private session(user: RecordEntity) {
    const actor = this.actor(user);
    return {
      token: signActorToken(actor, Number(user.tokenVersion ?? 0)),
      user: actor,
    };
  }
  private async recordAccess(action: string, user: RecordEntity) {
    const now = new Date().toISOString();
    await this.repo.mutate("audit", (entries) =>
      entries.push({
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
      }),
    );
  }
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
    const email = String((body as { email?: unknown })?.email ?? "")
      .trim()
      .toLowerCase();
    const user = (await this.repo.list("users")).find(
      (x) =>
        x.origin === "SEED" &&
        String(x.email).toLowerCase() === email &&
        x.active !== false,
    );
    if (!user) throw new UnauthorizedException("INVALID_CREDENTIALS");
    const now = new Date().toISOString();
    await this.repo.mutate("audit", (items) =>
      items.push({
        id: randomBytes(16).toString("hex"),
        version: 1,
        createdAt: now,
        updatedAt: now,
        organizationId: String(user.organizationId),
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        action: "LOGIN_DEMO",
        resource: "users",
        recordId: user.id,
      }),
    );
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
  async resetPassword(id: string, password: unknown, actor: Actor) {
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      throw new BadRequestException("PASSWORD_MINIMUM_12_CHARACTERS");
    const passwordHash = await bcrypt.hash(password, 12);
    const tables = {
      organizations: await this.repo.list("organizations"),
      parties: await this.repo.list("parties"),
    };
    await this.repo.mutate(
      "users",
      (items) => {
        const user = items.find(
          (x) =>
            x.id === id &&
            (actor.role !== "ORG_ADMIN" ||
              x.organizationId === actor.organizationId),
        );
        if (!user) throw new NotFoundException("USER_NOT_FOUND");
        // A company administrator resets only the accounts it may manage (never a controller's).
        const refusal = orgAdminRefusal(actor, user, tables);
        if (refusal) throw new ForbiddenException(refusal);
        user.passwordHash = passwordHash;
        user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
        user.version++;
        user.updatedAt = new Date().toISOString();
      },
      {
        id: randomBytes(16).toString("hex"),
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: "RESET_PASSWORD",
        resource: "users",
        recordId: id,
      },
    );
    return { updated: true };
  }
  /**
   * Self sign-up: a company and its account administrator (ORG_ADMIN), who then creates the
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
    const email =
      typeof admin.email === "string" ? admin.email.trim().toLowerCase() : "";
    const password = admin.password;
    if (!displayName || displayName.length > 250)
      throw new BadRequestException("REQUIRED:displayName");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new BadRequestException("INVALID_EMAIL");
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      throw new BadRequestException("PASSWORD_MINIMUM_12_CHARACTERS");
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
        if (
          tables.users.some(
            (item) => String(item.email).toLowerCase() === email,
          )
        )
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
          id: randomBytes(16).toString("hex"),
          version: 1,
          createdAt: now,
          updatedAt: now,
          organizationId: orgId,
          actorId: user.id,
          actorName: displayName,
          actorRole: "ORG_ADMIN",
          action: "REGISTER",
          resource: "organizations",
          recordId: orgId,
        },
      ],
    );
    return this.session(user);
  }
  async logout(actor: Actor) {
    await this.repo.transact(
      ["users"],
      (tables) => {
        const items = tables.users;
        const user = items.find((x) => x.id === actor.id);
        if (user) user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
      },
      () => [
        {
          id: randomBytes(16).toString("hex"),
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          organizationId: actor.organizationId,
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: actor.role,
          action: "LOGOUT",
          resource: "users",
          recordId: actor.id,
        },
      ],
    );
    return { loggedOut: true };
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
@Controller(".well-known")
export class JwksController {
  @Public() @Get("jwks.json") jwks() {
    return publicJwks();
  }
}
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(Repository) private repo: Repository,
  ) {}
  @Public() @Post("login") login(@Body() body: unknown) {
    return this.auth.login(body);
  }
  @Public() @Post("register") register(@Body() body: unknown) {
    return this.auth.register(body);
  }
  @Public() @Get("demo-accounts") demoAccounts() {
    return this.auth.demoAccounts();
  }
  @Public() @Post("demo-login") demoLogin(@Body() body: unknown) {
    return this.auth.demoLogin(body);
  }
  /** Demo deployments only, system administrator only; the previous data is archived, not deleted. */
  @RequirePermission("demo:reset")
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
  @Post("logout") logout(@Req() req: SessionRequest) {
    return this.auth.logout(req.user);
  }
  @Get("me") me(@Req() req: SessionRequest) {
    return req.user;
  }
  @RequirePermission("users:reset-password")
  @Post("users/:id/password")
  reset(
    @Param("id") id: string,
    @Body() body: { password: unknown },
    @Req() req: SessionRequest,
  ) {
    return this.auth.resetPassword(id, body?.password, req.user);
  }
}
