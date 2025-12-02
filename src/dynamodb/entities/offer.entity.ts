import { Transform } from "class-transformer";

export class Offer {
  id!: string;
  name!: string;
  brandId!: string;
  description!: string;

  @Transform(({ value }) => (value ? Array.from(value) : []), { toPlainOnly: true })
  locationIds?: Set<string>;

  locationsTotal!: number;
  createdAt!: string;
  updatedAt!: string;
}
