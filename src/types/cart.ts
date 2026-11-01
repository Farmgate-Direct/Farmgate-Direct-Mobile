export type CartItem = {
  docId?: string;
  productId: string;
  variationId: string;
  variationName: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmName: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  unit: string;
  createdAt: number;
};
