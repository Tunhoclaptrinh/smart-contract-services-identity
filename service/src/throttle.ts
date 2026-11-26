import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Request limits per client address (`@Throttle` on the sign-in routes, a generous default
 * elsewhere). Behind the gateway the client is the first `x-forwarded-for` address. Over the
 * limit: 429 `TOO_MANY_REQUESTS` in the shared problem format.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = req.headers as Record<string, string | undefined>;
    const forwarded = headers?.["x-forwarded-for"]?.split(",")[0]?.trim();
    return forwarded || String(req.ip ?? "unknown");
  }
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException("TOO_MANY_REQUESTS", HttpStatus.TOO_MANY_REQUESTS);
  }
}
