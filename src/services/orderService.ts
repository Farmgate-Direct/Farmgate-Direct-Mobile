// Order creation, payments, delivery quotes, and status changes. Anything that
// touches money or stock runs on the backend, never here.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  arrayUnion,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../../FirebaseConfig";

import type { OrderProduct, OrderType } from "../types/order";

const BACKEND_URL = String(
  process.env.EXPO_PUBLIC_BACKEND_URL || ""
).replace(/\/+$/, "");

const REQUEST_TIMEOUT = 30000;

// Sends a signed-in request to the backend and returns the parsed body. Server
// error codes are kept on the error so callers can map them to a message.
const requestBackend = async <T = any>(
  path: string,
  options: RequestInit = {},
  timeout = REQUEST_TIMEOUT
): Promise<T> => {
  if (!BACKEND_URL) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL is not configured.");
  }

  const user = getAuth().currentUser;

  if (!user) {
    throw new Error("Your login session has expired. Please login again.");
  }

  const token = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const text = await response.text();

    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const err: any = new Error(
        data?.error ||
          data?.message ||
          `Backend request failed with status ${response.status}.`
      );
      // Codes such as MANUAL_FEE_REQUIRED, FARM_MISSING_PICKUP, and RATE_LIMITED
      // are passed through so checkout can show a proper message and a retry.
      if (data?.code) err.code = data.code;
      err.status = response.status;
      throw err;
    }

    return data as T;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("The server took too long to respond. Please try again.");
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// Asks the backend for the live Xendit status of this order's GCash payment and
// fulfills the order when Xendit says SUCCEEDED. This repairs orders stuck in
// "pending" because the payment.capture webhook never arrived.
export const syncOrderPayment = async (
  orderId: string
): Promise<{
  success: boolean;
  orderId: string;
  paymentStatus: string;
  xenditStatus?: string;
  alreadyPaid?: boolean;
  alreadyFulfilled?: boolean;
  message?: string;
}> =>
  requestBackend(
    `/payment-sync/${encodeURIComponent(orderId)}`,
    { method: "POST" }
  );

// Places a new order through the backend. The backend recomputes the delivery
// fee from the farmer's stored pickup address and the buyer's address, so the
// fee sent from here is ignored. Subtotal and commission are also recalculated
// on the server when the order is accepted (COD) or paid (GCash), so no amount
// computed here is trusted for money.
export const createOrder = async (order: OrderType) => {
  const data = await requestBackend<{
    success: boolean;
    orderId: string;
    orderNumber: string;
    deliveryFee: number | null;
    distanceKm: number | null;
    adjustedDistanceKm: number | null;
    deliveryTier: string | null;
    feeStatus: "ok" | null;
    total: number;
  }>("/orders", {
    method: "POST",
    body: JSON.stringify({
      farmerId: order.farmerId,
      farmName: order.farmName,
      buyerName: order.buyerName,
      products: order.products,
      address: order.address,
      delivery: order.delivery,
      payment: order.payment,
      pickupDate: order.pickupDate ?? null,
      pickupTime: order.pickupTime ?? null,
      subTotal: order.subTotal,
    }),
  });

  return {
    id: data.orderId,
    orderNumber: data.orderNumber,
    deliveryFee: data.deliveryFee,
    distanceKm: data.distanceKm,
    adjustedDistanceKm: data.adjustedDistanceKm,
    deliveryTier: data.deliveryTier,
    feeStatus: data.feeStatus,
    total: data.total,
  };
};

export const recordWalkInSale = async (
  productId: string,
  variationId: string,
  quantity: number
) =>
  requestBackend(`/products/${encodeURIComponent(productId)}/sales`, {
    method: "POST",
    body: JSON.stringify({ variationId, quantity }),
  });

// Replaces the products of an order. This is only allowed while the order is
// still pending, because after acceptance the backend has already priced the
// order and, for GCash, created the payment.
export const updateOrderProducts = async (
  orderId: string,
  buyerId: string,
  products: OrderProduct[]
) => {
  try {
    const ref = doc(db, "orders", orderId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;

    if (order.buyerId !== buyerId) {
      throw new Error("You are not authorized to update this order.");
    }

    if (order.status !== "pending") {
      throw new Error("Products can only be changed while the order is pending.");
    }

    await updateDoc(ref, {
      products,
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.log("ERROR UPDATING ORDER PRODUCTS:", error);

    throw error;
  }
};

// Starts the GCash payment of an order the farmer has already accepted.
export const createGcashPayment = async (
  orderId: string,
  buyerId: string
) => {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;

    if (order.buyerId !== buyerId) {
      throw new Error("You are not authorized to pay for this order.");
    }

    if (order.payment !== "gcash") {
      throw new Error("This order is not a GCash order.");
    }

    if (order.status !== "accepted") {
      throw new Error("The farmer must accept the order before GCash payment.");
    }

    if (order.paymentStatus === "paid") {
      return {
        success: true,
        alreadyPaid: true,
        orderId,
        paymentStatus: "paid",
      };
    }

    // The timeout is generous here because the backend re-prices the order and
    // then calls Xendit.
    return await requestBackend(
      "/create-payment",
      {
        method: "POST",
        body: JSON.stringify({ orderId }),
      },
      60000
    );
  } catch (error) {
    console.log("ERROR CREATING GCASH PAYMENT:", error);
    throw error;
  }
};

// Reads the stored payment status of an order the buyer owns.
export const getOrderPaymentStatus = async (
  orderId: string,
  buyerId: string
) => {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;

    if (order.buyerId !== buyerId) {
      throw new Error("You are not authorized to view this payment status.");
    }

    return order.paymentStatus || "pending";
  } catch (error) {
    console.log("ERROR GETTING PAYMENT STATUS:", error);

    throw error;
  }
};

// Reads one order by its document id.
export const getOrderById = async (id: string) => {
  try {
    const snap = await getDoc(doc(db, "orders", id));

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    return {
      id: snap.id,
      ...snap.data(),
    } as OrderType;
  } catch (error) {
    console.log("ERROR GETTING ORDER:", error);

    throw error;
  }
};

// Normalizes the different Firestore timestamp shapes to milliseconds so
// orders can be sorted by date.
const toMillis = (ts: any) => {
  if (!ts) return 0;

  if (typeof ts.toMillis === "function") return ts.toMillis();

  if (typeof ts.seconds === "number") return ts.seconds * 1000;

  if (typeof ts === "number") return ts;

  if (typeof ts === "string") {
    const parsed = new Date(ts).getTime();

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

// Returns the orders a buyer placed, newest first.
export const getBuyerOrders = async (buyerId: string) => {
  try {
    const q = query(collection(db, "orders"), where("buyerId", "==", buyerId));

    const snapshot = await getDocs(q);

    const orders = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as OrderType)
    );

    return orders.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  } catch (error) {
    console.log("ERROR GETTING BUYER ORDERS:", error);

    throw error;
  }
};

// Returns the orders a farmer received, newest first.
export const getFarmerOrders = async (farmerId: string) => {
  try {
    const q = query(collection(db, "orders"), where("farmerId", "==", farmerId));

    const snapshot = await getDocs(q);

    const orders = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as OrderType)
    );

    return orders.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  } catch (error) {
    console.log("ERROR GETTING FARMER ORDERS:", error);

    throw error;
  }
};

// Flags one product of an order as reviewed so the rating modal does not
// appear again.
export const markProductReviewed = async (
  orderId: string,
  productId: string
) => {
  try {
    const ref = doc(db, "orders", orderId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;
    if (
      order.status !== "delivered" &&
      order.status !== "claimed"
    ) {
      throw new Error("Only completed orders can be reviewed.");
    }

    await updateDoc(ref, {
      reviewedProductIds: arrayUnion(productId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.log("ERROR MARKING REVIEW:", error);

    throw error;
  }
};

// Cancels an order on behalf of the buyer.
export const cancelOrder = async (
  orderId: string,
  buyerId: string,
  reason: string
) => {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;

    if (order.buyerId !== buyerId) {
      throw new Error("You are not authorized to cancel this order.");
    }

    if (order.payment === "gcash" && order.paymentStatus === "paid") {
      throw new Error(
        "This GCash order has already been paid and cannot be cancelled here because a refund is required."
      );
    }

    await requestBackend(
      `/wallet/orders/${encodeURIComponent(orderId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason?.trim() || "Cancelled by buyer." }),
      }
    );

    return true;
  } catch (error) {
    console.log("ERROR CANCELLING ORDER:", error);
    throw error;
  }
};

// Accepts an order on behalf of the farmer.
export const acceptOrder = async (orderId: string, farmerId: string) => {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;

    if (order.farmerId !== farmerId) {
      throw new Error("You are not authorized to accept this order.");
    }

    if (order.status !== "pending") {
      throw new Error("Only pending orders can be accepted.");
    }

    await requestBackend(
      `/wallet/orders/${encodeURIComponent(orderId)}/accept`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    return true;
  } catch (error) {
    console.log("ERROR ACCEPTING ORDER:", error);
    throw error;
  }
};

// Cancels an order the farmer already accepted.
export const cancelAcceptedOrderByFarmer = async (
  orderId: string,
  farmerId: string,
  reason: string
) => {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;

    if (order.farmerId !== farmerId) {
      throw new Error("You are not authorized to cancel this order.");
    }

    if (order.status !== "accepted") {
      throw new Error("Only accepted orders can be cancelled here.");
    }

    await requestBackend(
      `/wallet/orders/${encodeURIComponent(orderId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason?.trim() || "Cancelled by farmer." }),
      }
    );

    return true;
  } catch (error) {
    console.log("ERROR CANCELLING ACCEPTED ORDER BY FARMER:", error);
    throw error;
  }
};

// Declines a pending order. The backend handles this so an order that was
// already paid can never be declined and leave the buyer without their money.
export const declineOrder = async (
  orderId: string,
  farmerId: string,
  reason: string
) => {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));

    if (!snap.exists()) {
      throw new Error("Order not found.");
    }

    const order = snap.data() as OrderType;

    if (order.farmerId !== farmerId) {
      throw new Error("You are not authorized to decline this order.");
    }

    if (order.status !== "pending") {
      throw new Error("Only pending orders can be declined.");
    }

    await requestBackend(
      `/wallet/orders/${encodeURIComponent(orderId)}/decline`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason?.trim() || "Declined by farmer." }),
      }
    );

    return true;
  } catch (error) {
    console.log("ERROR DECLINING ORDER:", error);

    throw error;
  }
};

// Delivery quotes. The client never computes a fee it can trust: the backend
// reads each farm's barangay from users/{farmerId} and measures the distance
// from the barangay centroids. The buyer's location comes from the city and
// barangay of the address they picked.

// City, barangay, and province of the delivery destination.
export type BuyerLocation = {
  city: string;
  barangay: string;
  province?: string;
};

// The quote for one farm inside a cart.
export type QuoteBatchItem = {
  key: string;
  farmerId: string;
  success: boolean;
  deliveryFee?: number | null;
  distanceKm?: number | null;
  adjustedDistanceKm?: number | null;
  tier?: string | null;
  feeStatus?: "ok" | null;
  roadFactor?: number | null;
  tierVersion?: string | null;
  method?: string | null;
  code?: string;
  error?: string;
};

// Quotes every farm in the cart in a single call.
export const quoteDeliveries = async (
  items: { farmerId: string; key?: string }[],
  buyer: BuyerLocation | null,
  delivery: "pickup" | "delivery" = "delivery"
): Promise<QuoteBatchItem[]> => {
  if (delivery !== "delivery" || items.length === 0) {
    return [];
  }
  const data = await requestBackend<{ success: boolean; quotes: QuoteBatchItem[] }>(
    "/delivery/quote",
    {
      method: "POST",
      body: JSON.stringify({
        items,
        buyerCity: buyer?.city || "",
        buyerBarangay: buyer?.barangay || "",
        buyerProvince: buyer?.province || "",
        delivery,
      }),
    }
  );
  return Array.isArray(data?.quotes) ? data.quotes : [];
};

// Quotes the delivery fee for a single farm.
export const quoteDelivery = async (
  farmerId: string,
  buyer: BuyerLocation | null,
  delivery: "pickup" | "delivery" = "delivery"
): Promise<{ deliveryFee: number; distanceKm: number | null; tier: string | null }> => {
  if (delivery !== "delivery") {
    return { deliveryFee: 0, distanceKm: 0, tier: null };
  }
  return await requestBackend("/delivery/quote", {
    method: "POST",
    body: JSON.stringify({
      farmerId,
      buyerCity: buyer?.city || "",
      buyerBarangay: buyer?.barangay || "",
      buyerProvince: buyer?.province || "",
      delivery,
    }),
  });
};

// Moves an order to the next status, routing each step to the endpoint that
// belongs to it:
//  - accepted     : handled by acceptOrder, which prices the order
//  - processing   : COD stock is deducted atomically; GCash must already be paid
//  - to_receive   : only reachable from processing
//  - delivered and claimed: financial settlement, which is idempotent.
//    "claimed" is the pickup equivalent of "delivered" and uses the same endpoint.
export const updateOrderStatus = async (
  orderId: string,
  farmerId: string,
  status: "accepted" | "processing" | "to_receive" | "delivered" | "claimed"
) => {
  try {
    const encodedId = encodeURIComponent(orderId);

    if (status === "accepted") {
      return await acceptOrder(orderId, farmerId);
    }

    if (status === "processing") {
      await requestBackend(`/orders/${encodedId}/process`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      return true;
    }

    if (status === "to_receive") {
      await requestBackend(`/orders/${encodedId}/to-receive`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      return true;
    }

    if (status === "delivered" || status === "claimed") {
      // Settlement has to run on the trusted backend, and the backend also keeps the
      // delivery and wallet ledger updates idempotent. Pickup ("claimed") and
      // delivery ("delivered") share one settlement: the backend stores
      // "claimed" for pickup orders and "delivered" otherwise.
      return await requestBackend(`/wallet/orders/${encodedId}/deliver`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    }

    throw new Error("Invalid order status.");
  } catch (error) {
    console.log("ERROR UPDATING ORDER STATUS:", error);

    throw error;
  }
};
