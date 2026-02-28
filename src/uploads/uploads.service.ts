import { Injectable, Logger } from "@nestjs/common";
import { S3Service } from "../s3/s3.service";
import { PresignedUrlDto } from "./dto/presigned-url.dto";

export interface PresignedUrlResult {
  uploadUrl: string;
  key: string;
  bucket: string;
  expiresAt: string;
}

const EXPIRES_IN_SECONDS = 3600;

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly s3Service: S3Service) {}

  async getPresignedUrl(
    dto: PresignedUrlDto,
    userId: string,
  ): Promise<PresignedUrlResult> {
    const timestamp = Date.now();
    const key = `receipts/${userId}/${timestamp}-${dto.filename}`;

    const uploadUrl = await this.s3Service.getSignedUrl(
      key,
      EXPIRES_IN_SECONDS,
    );

    const expiresAt = new Date(
      Date.now() + EXPIRES_IN_SECONDS * 1000,
    ).toISOString();

    this.logger.log(`Presigned URL generated for user ${userId}, key: ${key}`);

    return {
      uploadUrl,
      key,
      bucket: this.s3Service.bucket,
      expiresAt,
    };
  }
}
