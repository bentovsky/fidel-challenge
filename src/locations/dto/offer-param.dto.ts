import { IsUUID } from "class-validator";

export class OfferParamDto {
  @IsUUID()
  offerId!: string;
}
