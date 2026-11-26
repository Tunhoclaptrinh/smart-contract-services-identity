import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  AuditExportController,
  BaseController,
  BaseService,
  bootstrapService,
  HealthController,
  PermissionsController,
  Repository,
  RolesGuard,
} from "@sc/nest-common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthController, AuthGuard, AuthService, JwksController } from "./auth";
import { ClientThrottlerGuard } from "./throttle";

/**
 * Identity service: companies, accounts, sign-in and sign-up. It signs the access tokens every
 * other service verifies (JwtAuthGuard); its own guard also checks the account is still active
 * and the token not revoked.
 */
@Module({
  // 300 requests a minute per client by default; sign-in routes set their own, stricter limit.
  imports: [
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 300 }]),
  ],
  controllers: [
    HealthController,
    AuthController,
    JwksController,
    BaseController,
    PermissionsController,
    AuditExportController,
  ],
  providers: [
    Repository,
    BaseService,
    AuthService,
    // Order matters: limits first, then the token sets req.user, then permissions are checked.
    { provide: APP_GUARD, useClass: ClientThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
class IdentityModule {}

void bootstrapService({
  module: IdentityModule,
  name: "identity",
  port: 3001,
  // Seed companies and accounts; production seeds only with an explicit SEED_PASSWORD.
  beforeListen: async (app) => {
    if (process.env.NODE_ENV !== "production" || process.env.SEED_PASSWORD)
      await app.get(AuthService).seed();
  },
});
