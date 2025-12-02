import { IsString, IsOptional } from "class-validator";

export class UpdateOfferDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
