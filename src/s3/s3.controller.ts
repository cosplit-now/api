import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { S3Service } from "./s3.service";

@Controller("s3")
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post("upload")
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body("key") key?: string
  ) {
    const imageKey = key || `${Date.now()}-${file.originalname}`;
    const url = await this.s3Service.uploadImage(
      imageKey,
      file.buffer,
      file.mimetype
    );

    return {
      success: true,
      url,
      key: imageKey,
    };
  }

  @Get("signed-url/:key")
  @AllowAnonymous()
  async getSignedUrl(@Param("key") key: string) {
    const url = await this.s3Service.getSignedUrl(key);

    return {
      success: true,
      url,
    };
  }

  @Delete(":key")
  @AllowAnonymous()
  async deleteImage(@Param("key") key: string) {
    await this.s3Service.deleteImage(key);

    return {
      success: true,
      message: "Image deleted successfully",
    };
  }
}
