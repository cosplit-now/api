import { Controller, Post, Body } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { S3Service } from "./s3.service";
import { generateObjectKey } from "./s3-key.util";

@Controller("s3")
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post("signed-url")
  @AllowAnonymous()
  async getSignedUrl(@Body("filename") filename: string) {
    const key = generateObjectKey(filename);
    const url = await this.s3Service.getSignedUrl(key);

    return {
      success: true,
      url,
      key,
    };
  }
}
