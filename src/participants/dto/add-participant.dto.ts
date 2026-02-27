import { IsOptional, IsString, IsNotEmpty } from "class-validator";

export class AddParticipantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  participantId?: string;
}
