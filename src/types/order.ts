// Every shape an order takes in Firestore, from the buyer's checkout through
// fulfilment, payment, and the farmer's wallet credit. Optional fields are the
// ones that only exist once that step has happened.
import { SaleContribution } from "./product";

// One line item. A single product can be split across harvest batches, so
// contributions says how many pieces came out of each one.
export type OrderProduct = {
  productId: string;
  batchId: string | null;
  batchNumber: number | null;
  harvestRecordId: string | null;
  contributions: SaleContribution[];
  name: string;
  image: string;
  price: number;
  quantity: number;
  unit: string;
  // Tray size the buyer chose. price, quantity, and unit are in that tray
  // size, while baseQuantity is the equivalent in the farmer's listing unit
  // and is what the backend deducts from stock.
  eggVariant?: "half" | "full" | null;
  baseUnit?: string;
  baseQuantity?: number;
  reviewed?: boolean;
};

// The address snapshot copied onto the order when it was placed, so a later
// edit to the buyer's saved address cannot change an order already in flight.
export type OrderAddress = {
  id?: string;
  fullName: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  phone: string;
  // Buyer map pin from the OpenStreetMap picker, limited to Bulacan. The text
  // fields above are what the courier reads, and they are never geocoded.
  lat?: number | null;
  lng?: number | null;
};

// Where the order sits in the buyer's and farmer's workflow.
export type OrderStatus =
  | "pending"
  | "accepted"
  | "processing"
  | "to_receive"
  | "delivered"
  | "claimed"
  | "cancelled";

// How the buyer pays, and where that payment currently stands.
export type PaymentMethod = "gcash" | "cod";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

// Whether stock was successfully taken out of the seller's batches.
export type FulfillmentStatus =
  | "pending"
  | "fulfilled"
  | "stock_unavailable"
  | "manual_review";

// Whether the platform commission has been taken from the order.
export type CommissionStatus =
  | "pending"
  | "charged"
  | "not_applicable";

// Tracks the commission held back from a COD order until it is collected.
export type CodCommissionReservationStatus =
  | "not_applicable"
  | "reserved"
  | "consumed"
  | "released";

export type OrderType = {
  id?: string;
  orderNumber?: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmName: string;
  products: OrderProduct[];
  delivery: "pickup" | "delivery";
  payment: PaymentMethod;
  address: OrderAddress | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  subTotal: number;
  deliveryFee: number;
  distanceKm?: number | null;
  adjustedDistanceKm?: number | null;
  deliveryTier?: string | null;
  feeStatus?: "ok" | null;
  roadFactor?: number | null;
  tierVersion?: string | null;
  deliveryMethod?: string | null;
  total: number;
  status: OrderStatus;

  farmerDecision?: "accepted" | "rejected";
  farmerDecisionAt?: any;
  rejectionReason?: string;

  createdAt?: any;
  processingAt?: any;
  toReceiveAt?: any;
  deliveredAt?: any;
  cancelledAt?: any;
  paidAt?: any;
  updatedAt?: any;
  inventoryFulfilledAt?: any;

  cancelledBy?: "buyer" | "farmer";
  cancelReason?: string;

  commissionRate?: number;
  commissionAmount?: number;
  commissionStatus?: CommissionStatus;
  commissionChargedAt?: any;

  farmerEarning?: number;
  farmerWalletCredited?: boolean;
  farmerWalletCreditedAt?: any;
  farmerWalletPendingCredited?: boolean;
  farmerWalletPendingCreditedAt?: any;
  financialStatus?: "pending" | "settled" | "refunded" | "manual_review";

  codCommissionReserved?: number;
  codCommissionReservationStatus?: CodCommissionReservationStatus;

  paymentStatus?: PaymentStatus;
  xenditPaymentRequestId?: string;
  xenditPaymentId?: string;
  xenditReferenceId?: string;
  xenditPaymentChannel?: string;
  xenditPaymentStatus?: string;
  paymentFailureCode?: string;
  paymentFailureReason?: string;
  paymentRequestCreatedAt?: any;

  inventoryFulfilled?: boolean;
  fulfillmentStatus?: FulfillmentStatus;
  fulfillmentError?: string;
  serverValidated?: boolean;
  serverValidatedAt?: any;

  xenditWebhookEvent?: string;
  xenditWebhookReceivedAt?: any;
};
