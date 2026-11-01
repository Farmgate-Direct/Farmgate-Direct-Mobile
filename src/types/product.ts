import type { OrderProduct } from "./order";

export type ProductCategory =
  | "Fruits"
  | "Egg & Poultry"
  | "Vegetables"
  | "Rice & Grains";

export type ProductUnit = "per kg" | "per pcs";

export type ProductStatus = "Available" | "Out of Stock";

export type ProductVariation = {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
  description?: string;
  status: ProductStatus;
  totalSales?: number;
};

export type CreateProductInput = {
  name: string;
  category: string;
  unit: string;
  description: string;
  freshness?: string;
  image: string;
  imagePublicId: string;
  images?: string[];
  imagePublicIds?: string[];
  video?: string;
  videoPublicId?: string;

  farmerId: string;
  farmerName: string;
  farmName: string;

  rating: number;
  totalReviews: number;
  totalSales: number;
  weeklySales: number;
  monthlySales: number;
  createdAt: number;

  // Kept as listing summaries for existing product cards and reports.
  price: number;
  stock: number;
  status: ProductStatus;
  variations: ProductVariation[];

  archived: boolean;
};

export type ProductType = CreateProductInput & {
  docId: string;
};

export type CreateReviewInput = {
  productId: string;
  orderProduct: OrderProduct;
  variationId?: string | null;
  variationName?: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  buyerProfileImage?: string;
  rating: number;
  comment: string;
  createdAt: number;
};

export type ReviewType = CreateReviewInput & {
  docId: string;
};
