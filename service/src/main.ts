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
import { AuthController, AuthGuard, AuthService, JwksController } from "./auth";

/**
 * Identity service: companies, accounts, sign-in and sign-up. It signs the access tokens every
 * other service verifies (JwtAuthGuard); its own guard also checks the account is still active
 * and the token not revoked.
 */
@Module({
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
    // Order matters: the token sets req.user, then roles and permissions are checked.
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
