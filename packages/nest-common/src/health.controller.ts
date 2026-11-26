import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Public } from "./decorators/roles.decorator";
import { Repository } from "./repository";

/**
 * `GET /health`: readiness of the service, storage included (a database round trip), so the
 * gateway, compose and CI only send traffic to a service that can answer. 503 when storage is down.
 */
@Controller("health")
export class HealthController {
  constructor(@Inject(Repository) private repo: Repository) {}
  @Public() @Get() async health() {
    const started = Date.now();
    try {
      await this.repo.ping();
    } catch {
      throw new ServiceUnavailableException("STORAGE_UNAVAILABLE");
    }
    return {
      status: "ok",
      service: process.env.SERVICE_NAME ?? "service",
      storage: this.repo.driver,
      storageLatencyMs: Date.now() - started,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
