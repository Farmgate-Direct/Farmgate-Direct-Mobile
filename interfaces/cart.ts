// The older, looser shape of a cart line. The live cart uses the CartItem type
// in src/types/cart.ts, which also carries the batch and stock fields.
export interface CartItem {
  id: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  farmerId: string;
  farmerName: string;
}
