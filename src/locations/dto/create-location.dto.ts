import { IsString, IsNotEmpty, IsUUID } from "class-validator";

export class CreateLocationDto {
  @IsUUID()
  @IsNotEmpty()
  brandId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;
}
