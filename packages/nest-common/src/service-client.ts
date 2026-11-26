import {
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
  BadGatewayException,
} from "@nestjs/common";
import { auditContext } from "./audit-events";

/**
 * Calls from one service to another (MS-R5). Every call has a timeout; only infrastructure
 * failures are retried, and only for idempotent methods; a business answer (4xx) of the target
 * comes back unchanged with its status and code, never retried:
 *
 * | Target                          | Caller gets                         | Retried            |
 * | ------------------------------- | ----------------------------------- | ------------------ |
 * | 2xx                             | the `data` of the envelope          | —                  |
 * | 4xx (business, auth)            | same status, same `code`            | no                 |
 * | 5xx                             | 502 `UPSTREAM_ERROR`                | yes (idempotent)   |
 * | refused / unreachable           | 503 `UPSTREAM_UNAVAILABLE`          | yes (idempotent)   |
 * | slower than the timeout         | 504 `UPSTREAM_TIMEOUT`              | yes (idempotent)   |
 *
 * The address comes from an environment variable (`CONTRACT_URL`…), the caller's token and
 * `x-request-id` are passed on so the target checks the same actor and logs one trace.
 */
export interface CallOptions {
  body?: unknown;
  /** Bearer token to pass on (usually the caller's own). */
  token?: string;
  timeoutMs?: number;
  /** Extra attempts after the first, for idempotent calls. */
  retries?: number;
  headers?: Record<string, string>;
  /** Send `Idempotency-Key` so a retried POST is safe on a target that honours it. */
  idempotencyKey?: string;
}

const IDEMPOTENT = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export class ServiceClient {
  constructor(
    /** Name shown in errors and logs, e.g. "contract". */
    readonly target: string,
    /** Base URL ending before `/api/v1`, e.g. process.env.CONTRACT_URL. */
    private baseUrl: string | undefined,
    private defaults: { timeoutMs?: number; retries?: number } = {},
  ) {}

  /** Client for `<NAME>_URL`, e.g. `ServiceClient.fromEnv("contract")` reads CONTRACT_URL. */
  static fromEnv(
    target: string,
    defaults?: { timeoutMs?: number; retries?: number },
  ) {
    const variable = `${target.toUpperCase().replace(/-/g, "_")}_URL`;
    return new ServiceClient(target, process.env[variable], defaults);
  }

  get<T>(path: string, options?: CallOptions) {
    return this.call<T>("GET", path, options);
  }
  post<T>(path: string, options?: CallOptions) {
    return this.call<T>("POST", path, options);
  }
  patch<T>(path: string, options?: CallOptions) {
    return this.call<T>("PATCH", path, options);
  }
  delete<T>(path: string, options?: CallOptions) {
    return this.call<T>("DELETE", path, options);
  }

  async call<T>(
    method: string,
    path: string,
    options: CallOptions = {},
  ): Promise<T> {
    if (!this.baseUrl)
      throw new ServiceUnavailableException(
        `UPSTREAM_NOT_CONFIGURED:${this.target}`,
      );
    const timeoutMs = options.timeoutMs ?? this.defaults.timeoutMs ?? 3000;
    const safe = IDEMPOTENT.has(method) || Boolean(options.idempotencyKey);
    const retries = safe ? (options.retries ?? this.defaults.retries ?? 2) : 0;
    const requestId = auditContext.getStore()?.requestId;
    const headers: Record<string, string> = {
      accept: "application/json",
      ...(options.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(requestId ? { "x-request-id": requestId } : {}),
      ...(options.idempotencyKey
        ? { "idempotency-key": options.idempotencyKey }
        : {}),
      ...options.headers,
    };
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/v1${path}`;
    let failure: HttpException = new ServiceUnavailableException(
      "UPSTREAM_UNAVAILABLE",
    );
    for (let attempt = 0; attempt <= retries; attempt++) {
      // Exponential backoff with jitter: 100 ms, 200 ms, … between attempts.
      if (attempt) await sleep(100 * 2 ** (attempt - 1) + Math.random() * 50);
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers,
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const timedOut = (error as { name?: string })?.name === "TimeoutError";
        failure = timedOut
          ? new GatewayTimeoutException(`UPSTREAM_TIMEOUT:${this.target}`)
          : new ServiceUnavailableException(
              `UPSTREAM_UNAVAILABLE:${this.target}`,
            );
        continue;
      }
      const text = await res.text();
      let body: { data?: unknown; code?: string; errors?: unknown } | undefined;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = undefined;
      }
      if (res.ok) return (body && "data" in body ? body.data : body) as T;
      if (res.status < 500) {
        // A business or authorization answer: pass it on as the target gave it.
        throw new HttpException(
          {
            message: body?.code ?? `UPSTREAM_${res.status}`,
            ...(body?.errors ? { errors: body.errors } : {}),
          },
          res.status,
        );
      }
      failure =
        res.status === 503
          ? new ServiceUnavailableException(
              `UPSTREAM_UNAVAILABLE:${this.target}`,
            )
          : res.status === 504
            ? new GatewayTimeoutException(`UPSTREAM_TIMEOUT:${this.target}`)
            : new BadGatewayException(`UPSTREAM_ERROR:${this.target}`);
    }
    throw failure;
  }
}
