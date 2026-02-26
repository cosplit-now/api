import { IsArray, IsString, ArrayMinSize, ArrayUnique } from "class-validator";

export class CreateReceiptDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @ArrayUnique()
  attachmentIds: string[];
}
