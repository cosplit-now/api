import { Controller, Post, Body } from "@nestjs/common";
import { Public } from "../auth/decorators";
import { generateObjectKey } from "./s3-key.util";
import { S3Service } from "./s3.service";

@Controller("s3")
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post("signed-url")
  @Public()
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
