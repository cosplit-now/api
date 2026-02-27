import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsString,
  ValidateNested,
} from "class-validator";

export class AllocationItemDto {
  @IsString()
  participantId: string;

  @IsIn(["equal", "shares", "custom"])
  type: "equal" | "shares" | "custom";

  @IsString()
  value: string;
}

export class PutAllocationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationItemDto)
  allocations: AllocationItemDto[];
}
