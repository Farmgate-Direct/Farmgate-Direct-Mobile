// Groups cart items by farmer for checkout.
import { CartItem } from "../types/cart";

// One farmer's basket, including every product bought from that farmer.
export type FarmerCart = {
  farmerId: string;
  farmName: string;
  products: CartItem[];
};

// Splits the cart into one group per farmer because each farm is fulfilled separately.
export const groupCartByFarmer = (items: CartItem[]): FarmerCart[] => {
  const grouped: FarmerCart[] = [];

  items.forEach((item) => {
    // Reuse the existing group when this farmer is already in the list.
    const existing = grouped.find(
      (f) => f.farmerId === item.farmerId
    );

    if (existing) {
      existing.products.push(item);
    } else {
      grouped.push({
        farmerId: item.farmerId || "",
        farmName: item.farmName || "",
        products: [item],
      });
    }
  });

  return grouped;
};