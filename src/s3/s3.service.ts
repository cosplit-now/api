import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type EnvironmentVariables } from "../config/env.schema";

const R2_PUBLIC_BASE_URL =
  "https://pub-e6cf3f9edbf4434eaf774e9c2e311141.r2.dev";

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    const accountId = this.configService.get("R2_ACCOUNT_ID", {
      infer: true,
    });
    const accessKeyId = this.configService.get("R2_ACCESS_KEY_ID", {
      infer: true,
    });
    const secretAccessKey = this.configService.get("R2_SECRET_ACCESS_KEY", {
      infer: true,
    });
    this.bucket = this.configService.get("R2_BUCKET", {
      infer: true,
    });
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials not configured");
    }

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  // 生成用于上传的签名 URL
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  // 生成用于下载的签名 URL
  async getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteImage(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async ping(): Promise<void> {
    const command = new HeadBucketCommand({
      Bucket: this.bucket,
    });

    await this.client.send(command);
  }

  getPublicUrl(key: string): string {
    const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
    return `${R2_PUBLIC_BASE_URL}/${normalizedKey}`;
  }
}
