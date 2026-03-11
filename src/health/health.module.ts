import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { S3Module } from "../s3/s3.module";
import { S3HealthIndicator } from "./s3-health.indicator";

@Module({
  imports: [TerminusModule, S3Module],
  controllers: [HealthController],
  providers: [S3HealthIndicator],
})
export class HealthModule {}
