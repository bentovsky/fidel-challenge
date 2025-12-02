import { Transform } from "class-transformer";

export class Location {
  id!: string;
  brandId!: string;
  name!: string;
  address!: string;

  @Transform(({ value }) => (value ? Array.from(value) : []), { toPlainOnly: true })
  offerIds?: Set<string>;

  hasOffer!: boolean;
  createdAt!: string;
  updatedAt!: string;
}
