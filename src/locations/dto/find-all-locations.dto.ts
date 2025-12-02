import { IsOptional, IsInt, IsString, Min, Max, IsBase64, IsUUID } from "class-validator";
import { Type } from "class-transformer";

export class FindAllLocationsDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "limit must be an integer" })
  @Min(1, { message: "limit must be at least 1" })
  @Max(100, { message: "limit must not exceed 100" })
  limit?: number;

  @IsOptional()
  @IsString()
  @IsBase64()
  cursor?: string;
}
