import { IsNotEmpty, IsNumber, IsPositive, IsString } from "class-validator";

export class PresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsNumber()
  @IsPositive()
  sizeBytes: number;
}
