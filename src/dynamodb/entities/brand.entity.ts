import { Exclude } from "class-transformer";

export class Brand {
  id!: string;
  name!: string;

  @Exclude({ toPlainOnly: true })
  nameLower!: string;

  description!: string;
  createdAt!: string;
  updatedAt!: string;
}
