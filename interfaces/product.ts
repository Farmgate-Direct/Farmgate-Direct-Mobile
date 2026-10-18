// Older, looser product shape: most fields optional and kept as strings.
// The app now uses the ProductType shape in src/types/product.ts.
export interface Product {
  id: string;
  name: string;
  category?: string;
  price?: string;
  stock?: string;
  status?: string;
  image?: string;
  farmerId?: string;
  farmerName?: string;
  farmName?: string;
  freshness?: string;  // For example "1 day" or "5 days"
  rating?: string;
  createdAt?: number;  // Timestamp in milliseconds
}