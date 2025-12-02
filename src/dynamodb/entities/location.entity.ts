import { Exclude, Transform } from "class-transformer";

export class Location {
  id!: string;
  brandId!: string;
  name!: string;

  @Exclude({ toPlainOnly: true })
  nameLower!: string;

  address!: string;

  @Transform(({ value }) => (value ? Array.from(value) : []), { toPlainOnly: true })
  offerIds?: Set<string>;

  hasOffer!: boolean;
  createdAt!: string;
  updatedAt!: string;
}
