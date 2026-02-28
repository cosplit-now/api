import { Injectable } from "@nestjs/common";
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from "@nestjs/terminus";
import { S3Service } from "../s3/s3.service";

@Injectable()
export class S3HealthIndicator {
  constructor(
    private readonly s3Service: S3Service,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.s3Service.ping();
      return this.healthIndicatorService.check(key).up();
    } catch (error) {
      console.log("S3 health check failed", error);
      return this.healthIndicatorService
        .check(key)
        .down({ message: "S3 health check failed" });
    }
  }
}
