import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { Transport } from "@nestjs/microservices";
import {
  HealthCheck,
  HealthCheckService,
  MicroserviceHealthIndicator,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { ConfigService } from "@nestjs/config";
import { type EnvironmentVariables } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import { S3HealthIndicator } from "./s3-health.indicator";
import { Public } from "../auth/decorators";

@Controller({ version: VERSION_NEUTRAL, path: "health" })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly microserviceHealth: MicroserviceHealthIndicator,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly s3Health: S3HealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    const redisHost = this.configService.get("REDIS_HOST", { infer: true });
    const redisPort = this.configService.get("REDIS_PORT", { infer: true });

    return this.health.check([
      () => this.prismaHealth.pingCheck("database", this.prisma),
      () =>
        this.microserviceHealth.pingCheck("redis", {
          transport: Transport.REDIS,
          options: {
            host: redisHost,
            port: redisPort,
          },
        }),
      () => this.s3Health.isHealthy("s3"),
    ]);
  }
}
