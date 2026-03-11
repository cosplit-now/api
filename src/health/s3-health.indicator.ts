import { Injectable, Logger } from "@nestjs/common";
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from "@nestjs/terminus";
import { S3Service } from "../s3/s3.service";

@Injectable()
export class S3HealthIndicator {
  private readonly logger = new Logger(S3HealthIndicator.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.s3Service.ping();
      return this.healthIndicatorService.check(key).up();
    } catch (error) {
      this.logger.warn(
        "S3 health check failed",
        error instanceof Error ? error.stack : String(error),
      );
      return this.healthIndicatorService
        .check(key)
        .down({ message: "S3 health check failed" });
    }
  }
}
