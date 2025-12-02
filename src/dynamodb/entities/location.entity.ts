export interface Location {
  id: string;
  brandId: string;
  name: string;
  address: string;
  offerIds?: Set<string>;
  hasOffer: boolean;
  createdAt: string;
  updatedAt: string;
}
