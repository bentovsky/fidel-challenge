import { IsString, IsNotEmpty, IsUUID } from "class-validator";

export class CreateOfferDto {
  @IsUUID()
  @IsNotEmpty()
  brandId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
