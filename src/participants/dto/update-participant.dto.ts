import { IsString, IsNotEmpty } from "class-validator";

export class UpdateParticipantDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
