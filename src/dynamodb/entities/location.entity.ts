export interface LocationOffer {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  address: string;
  brandId: string;
  offer?: LocationOffer;
  createdAt: string;
  updatedAt: string;
}
