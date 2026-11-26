import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import jwt from "jsonwebtoken";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { repoRoot } from "./paths";
import { auditContext } from "./audit-events";
import { permissionsFor } from "./permissions";
import type { Actor, Role } from "./types";

/**
 * Access tokens between services, RS256. Identity signs with its private key and publishes the
 * public key as a JWKS (`GET /.well-known/jwks.json`); the gateway and every other service verify
 * with the public key only, so no service but identity can mint a token. Revocation (`tv`, the
 * user's token version) is checked only by identity, so a revoked token stays valid elsewhere
 * until it expires: access tokens are short (TOKEN_TTL, default 15m) and renewed with a refresh
 * token held by identity.
 *
 * Keys: JWT_PRIVATE_KEY (PEM, identity, required in production). Verifiers use JWT_PUBLIC_KEY
 * (PEM) and/or JWKS_URL. Outside production a signing key is generated once in JWT_KEY_DIR
 * (default `<repo>/.data-jwt`), and a service verifies with it too, so local tests need no setup.
 */
export const TOKEN_ISSUER = "sc-identity";
export const TOKEN_AUDIENCE = "sc-web";
const ALGORITHM = "RS256";

const production = () => process.env.NODE_ENV === "production";
const keyFile = () =>
  resolve(repoRoot(), process.env.JWT_KEY_DIR ?? ".data-jwt", "signing.pem");

let signing: { key: KeyObject; kid: string; pem: string } | undefined;
/** Key id: RFC 7638 thumbprint of the public key. */
export function keyId(publicKey: KeyObject): string {
  const { e, kty, n } = publicKey.export({ format: "jwk" });
  return createHash("sha256")
    .update(JSON.stringify({ e, kty, n }))
    .digest("base64url");
}
/** The signing key: JWT_PRIVATE_KEY, or (not production) a key generated once on disk. */
export function signingKey() {
  const pem = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (signing && (!pem || signing.pem === pem)) return signing;
  let text = pem;
  if (!text) {
    if (production()) throw new Error("JWT_PRIVATE_KEY is required");
    const file = keyFile();
    if (!existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      writeFileSync(
        file,
        privateKey.export({ format: "pem", type: "pkcs8" }) as string,
        { mode: 0o600, flag: "wx" },
      );
    }
    text = readFileSync(file, "utf8");
  }
  const key = createPrivateKey(text);
  signing = { key, kid: keyId(createPublicKey(key)), pem: pem ?? "" };
  return signing;
}

/** Public keys a verifier accepts, by key id. */
const verifyKeys = new Map<string, KeyObject>();
function addPublicKey(key: KeyObject, kid = keyId(key)) {
  verifyKeys.set(kid, key);
}
function loadStaticKeys() {
  const pem = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n");
  if (pem) addPublicKey(createPublicKey(pem));
  // Identity itself, and any service in development: the local signing key verifies too.
  if (process.env.JWT_PRIVATE_KEY || (!production() && existsSync(keyFile())))
    addPublicKey(createPublicKey(signingKey().key));
}

let jwksFetched = 0;
/**
 * Fetches JWKS_URL (identity's keys) when a token names a key we do not have, at most every 30
 * seconds, so a rotated key is picked up without a restart.
 */
export async function refreshJwks(force = false) {
  const url = process.env.JWKS_URL;
  if (!url || (!force && Date.now() - jwksFetched < 30_000)) return;
  jwksFetched = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return;
    const body = (await res.json()) as {
      keys?: JsonWebKey[];
      data?: { keys?: JsonWebKey[] };
    };
    for (const jwk of body.keys ?? body.data?.keys ?? [])
      if (jwk.kty === "RSA")
        addPublicKey(
          createPublicKey({ key: jwk, format: "jwk" }),
          typeof (jwk as { kid?: unknown }).kid === "string"
            ? (jwk as { kid: string }).kid
            : undefined,
        );
  } catch {
    // Identity unreachable: keep the keys we have; unknown tokens fail as INVALID_SESSION.
  }
}

/** The JWKS identity publishes. */
export function publicJwks() {
  const { key, kid } = signingKey();
  return {
    keys: [
      {
        ...createPublicKey(key).export({ format: "jwk" }),
        kid,
        use: "sig",
        alg: ALGORITHM,
      },
    ],
  };
}

interface ActorClaims extends jwt.JwtPayload {
  sub: string;
  tv: number;
  role: Role;
  org: string;
  chip: string;
  party: string | null;
  name: string;
  email: string;
  title: string;
}

export function signActorToken(actor: Actor, tokenVersion = 0) {
  const claims: Omit<ActorClaims, "sub"> = {
    tv: tokenVersion,
    role: actor.role,
    org: actor.organizationId,
    chip: actor.roleChipOrganization,
    party: actor.partyId,
    name: actor.displayName,
    email: actor.email,
    title: actor.title,
  };
  const { key, kid } = signingKey();
  return jwt.sign(claims, key, {
    algorithm: ALGORITHM,
    keyid: kid,
    subject: actor.id,
    expiresIn: (process.env.TOKEN_TTL ?? "15m") as jwt.SignOptions["expiresIn"],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}

/** The actor in a token, or UnauthorizedException("INVALID_SESSION"). */
export function verifyActorToken(token: string): {
  actor: Actor;
  tokenVersion: number;
} {
  try {
    if (!verifyKeys.size) loadStaticKeys();
    const kid = jwt.decode(token, { complete: true })?.header.kid;
    const key = kid ? verifyKeys.get(kid) : undefined;
    if (!key) throw new Error("unknown key");
    const c = jwt.verify(token, key, {
      algorithms: [ALGORITHM],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    }) as ActorClaims;
    if (typeof c.sub !== "string" || typeof c.role !== "string")
      throw new Error("claims");
    return {
      tokenVersion: Number(c.tv ?? 0),
      actor: {
        id: c.sub,
        email: c.email,
        displayName: c.name,
        role: c.role,
        organizationId: c.org,
        roleChipOrganization: c.chip ?? c.org,
        partyId: c.party ?? null,
        title: c.title ?? "",
        permissions: permissionsFor(c.role),
        active: true,
      },
    };
  } catch {
    throw new UnauthorizedException("INVALID_SESSION");
  }
}

/** As verifyActorToken, first fetching identity's keys when the token's key is unknown. */
export async function verifyActorTokenAsync(token: string) {
  if (!verifyKeys.size) loadStaticKeys();
  const kid = jwt.decode(token, { complete: true })?.header.kid;
  if (typeof kid === "string" && !verifyKeys.has(kid)) await refreshJwks();
  return verifyActorToken(token);
}

/** The bearer token of a request, or UnauthorizedException("AUTHENTICATION_REQUIRED"). */
export function bearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer "))
    throw new UnauthorizedException("AUTHENTICATION_REQUIRED");
  return header.slice(7);
}

/**
 * Global guard of every service except identity: `@Public()` routes pass, every other request
 * needs a valid token and gets `req.user` (and the audit actor) from its claims. Register it
 * before RolesGuard.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride("public", [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest();
    req.user = (
      await verifyActorTokenAsync(bearerToken(req.headers.authorization))
    ).actor;
    const context = auditContext.getStore();
    if (context) context.actor = req.user;
    return true;
  }
}
