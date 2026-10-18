export type EggVariant = "half" | "full";

// A product line in the cart. The quantity, unit, and price are stored in the
// tray size the buyer chose, while baseUnit and baseQuantity keep the farmer's
// listing unit so stock math stays correct.
export type CartItem = {
  docId?: string;
  productId: string;
  batchId: string;
  batchNumber: number;
  buyerId: string;
  buyerName: string;
  farmerId?: string;
  farmName?: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  unit: string;
  eggVariant?: EggVariant | null;
  baseUnit?: string;
  baseQuantity?: number;
  createdAt: number;
};