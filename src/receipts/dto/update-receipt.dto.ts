import { IsDateString, IsOptional, IsString } from "class-validator";

export class UpdateReceiptDto {
  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  storeAddress?: string;

  @IsOptional()
  @IsDateString()
  receiptDate?: string;
}
