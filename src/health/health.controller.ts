import { Controller, Get } from "@nestjs/common";
import { Transport } from "@nestjs/microservices";
import {
  HealthCheck,
  HealthCheckService,
  MicroserviceHealthIndicator,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { PrismaService } from "../prisma/prisma.service";
import { S3HealthIndicator } from "./s3-health.indicator";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly microserviceHealth: MicroserviceHealthIndicator,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly s3Health: S3HealthIndicator,
  ) {}

  @Get()
  @AllowAnonymous()
  @HealthCheck()
  check() {
    const redisHost = process.env["REDIS_HOST"];
    const redisPort = Number(process.env["REDIS_PORT"] ?? "6379");

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
