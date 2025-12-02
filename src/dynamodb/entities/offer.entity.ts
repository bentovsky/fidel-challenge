export interface Offer {
  id: string;
  name: string;
  brandId: string;
  description: string;
  locationIds?: Set<string>;
  locationsTotal: number;
  createdAt: string;
  updatedAt: string;
}
