// Fee tiers used only to preview a delivery fee on the buyer side, so the
// numbers here are never trusted by the app. The backend recomputes the real
// fee from city and barangay when an order is created, when a quote is
// requested, and when a COD order is accepted or a GCash payment is started.
// This table must stay in sync with FEE_TIERS in farmgate-backend/distance.js.
export const FEE_TIERS: { maxKm: number; fee: number; label: string }[] = [
  { maxKm: 3, fee: 25, label: "0–3 km" },
  { maxKm: 5, fee: 35, label: "3.1–5 km" },
  { maxKm: 10, fee: 50, label: "5.1–10 km" },
  { maxKm: 15, fee: 70, label: "10.1–15 km" },
  { maxKm: 20, fee: 90, label: "15.1–20 km" },
  { maxKm: 25, fee: 110, label: "20.1–25 km" },
  { maxKm: 30, fee: 130, label: "25.1–30 km" },
  { maxKm: 40, fee: 160, label: "30.1–40 km" },
  { maxKm: 50, fee: 190, label: "40.1–50 km" },
  { maxKm: 60, fee: 220, label: "50.1–60 km" },
  { maxKm: 70, fee: 250, label: "60.1–70 km" },
];

// Bumped whenever the tier table changes, so a stale cached fee can be detected.
export const TIER_VERSION = "barangay-1.3-v2";

// Farthest distance we allow for automatic delivery.
export const MAX_AUTO_KM = 70;

// Looks up the fee for a distance, or null when the distance is over the limit.
export const feeForAdjustedDistance = (
  adjustedKm: number
): { fee: number; tier: string } | null => {
  for (const t of FEE_TIERS) {
    if (adjustedKm <= t.maxKm) return { fee: t.fee, tier: t.label };
  }
  // Past 70 km the backend rejects the order with TOO_FAR, so there is no fee to show.
  return null;
};

// Result of a delivery fee lookup.
export type DeliveryQuote = {
  deliveryFee: number;
  distanceKm: number | null;
  adjustedDistanceKm: number | null;
  tier: string | null;
};

// Error shape returned when a delivery quote cannot be produced.
export type DeliveryQuoteError = {
  code?: string;
  message: string;
};

// Turns a delivery error code into a message the buyer can act on.
export const deliveryErrorMessage = (code?: string): string => {
  let base: string;
  switch (code) {
    case "FARM_MISSING_BARANGAY":
      base = "This farm has no barangay set, so delivery is blocked until the farmer picks it.";
      break;
    case "ADDRESS_MISSING_BARANGAY":
      base = "Pick your City and Barangay again.";
      break;
    case "INVALID_PROVINCE":
      base = "Delivery is Bulacan-only. Please pick an address in Bulacan.";
      break;
    case "UNKNOWN_CITY":
      base = "Unknown city/municipality. Please pick it from the list.";
      break;
    case "UNKNOWN_BARANGAY":
      base = "Unknown barangay. Please pick it from the list.";
      break;
    case "BARANGAY_NOT_SERVICEABLE":
      base = "This barangay can't be delivered to yet.";
      break;
    case "TOO_FAR":
      base = "Over the 70 km delivery limit — delivery is not allowed for this address.";
      break;
    case "RATE_LIMITED":
      base = "Too many quotes. Wait a moment and tap Try again.";
      break;
    case "FARM_NOT_FOUND":
      base = "We couldn't find this farm. Please refresh and try again.";
      break;
    default:
      base = "Delivery isn't available right now. Please try again in a moment.";
      break;
  }
  return base;
};

// Formats a distance for display, showing a dash when it is unknown.
export const formatKm = (km: number | null | undefined): string =>
  km === null || km === undefined ? "—" : `${Number(km).toFixed(1)} km`;

// Formats an amount as pesos with two decimals.
export const formatPeso = (n: number | null | undefined): string =>
  `₱${Number(n || 0).toFixed(2)}`;
