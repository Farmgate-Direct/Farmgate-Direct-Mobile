// The product document, its harvest batches, and its reviews. A product is the
// stable listing; batches are the dated stock lots a farmer sells from.
export type ProductCategory =
  | "Fruits"
  | "Egg & Poultry"
  | "Vegetables"
  | "Rice & Grains";

export type ProductUnit = "per kg" | "per pcs";

export type ProductStatus = "Available" | "Out of Stock";

// The product document a farmer creates, shared by its batches and reviews.
export type CreateProductInput = {
  name: string;
  category: string;
  unit: string;
  description: string;
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

  // Values copied here to make lists easy to render. Real inventory lives in
  // productBatches.
  price: number;
  stock: number;
  status: string;

  // Set when the farmer archives the product instead of deleting it.
  archived: boolean;
};

export type ProductType = CreateProductInput & {
  docId: string;
};

// An optional inventory group inside a product. There is no automatic weekly
// or new batch rule: the farmer decides whether a new harvest joins the latest
// active batch or starts a new batch.
export type CreateBatchInput = {
  productId: string;
  farmerId: string;

  batchNumber: number;

  price: number;
  stock: number;
  totalHarvested: number;

  // Either "Available" or "Out of Stock".
  status: string;

  createdAt: number;

  // Set when the farmer archives the batch instead of deleting it.
  archived: boolean;

  // True when the batch was archived because its product was archived, and
  // false when the farmer archived the batch on its own.
  archivedViaProduct: boolean;
};

export type BatchType = CreateBatchInput & {
  docId: string;
};

// A record of one harvest or restock, used to trace stock back to a date.
export type CreateHarvestRecordInput = {
  batchId: string;
  productId: string;
  farmerId: string;

  quantity: number;
  remainingQuantity: number;
  harvestDate: number;
  createdAt: number;

  type: "harvest" | "restock";
};

export type HarvestRecordType = CreateHarvestRecordInput & {
  docId: string;
};

// A rating and comment a buyer leaves after an order.
export type CreateReviewInput = {
  productId: string;
  batchId: string;
  batchNumber: number;
  harvestRecordId?: string;
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

// The part of a sale that came from one batch, so stock is deducted from the
// right place.
export type SaleContribution = {
  batchId: string;
  batchNumber: number;
  harvestRecordId: string | null;
  quantity: number;
};
