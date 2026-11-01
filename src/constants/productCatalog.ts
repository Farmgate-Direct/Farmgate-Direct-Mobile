// Fixed list of product names per category, used by the Add Product dropdown.
// Farmers pick a name from the list instead of typing it, which prevents
// duplicate products that differ only in spelling, letter case, or extra
// spaces, such as "Eggplant" versus "eggplant " versus "EGGPLANT".
// To add a product, just append it to the array of its category. Nothing else
// in the app needs to change.

// Categories a farmer is allowed to list products under.
export const CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Egg & Poultry",
  "Rice & Grains",
] as const;

// One of the category names above.
export type ProductCategoryKey = (typeof CATEGORIES)[number];

// Product names offered inside each category.
export const PRODUCT_CATALOG: Record<ProductCategoryKey, string[]> = {
  Vegetables: [
    "Eggplant (Talong)",
    "Tomato (Kamatis)",
    "Okra",
    "Ampalaya (Bitter Gourd)",
    "Pole Sitaw (String Beans)",
    "Bush Sitaw",
    "Baguio Beans (Habichuelas)",
    "Kalabasa (Squash)",
    "Repolyo (Cabbage)",
    "Pechay Baguio",
    "Native Pechay (Tagalog)",
    "Sibuyas (Onion)",
    "Bawang (Garlic)",
    "Luya (Ginger)",
    "Patatas (Potato)",
    "Carrots",
    "Labanos (Radish)",
    "Kangkong",
    "Malunggay",
    "Sayote",
    "Upo (Bottle Gourd)",
    "Patola (Sponge Gourd)",
    "Sili (Chili Pepper)",
  ],
  Fruits: [
    "Banana Lakatan",
    "Banana Latundan",
    "Banana Saba",
    "Mango Carabao",
    "Mango Pico",
    "Mango Indian",
    "Mango Apple",
    "Mango Paho",
    "Papaya",
    "Pomelo",
    "Melon",
    "Pineapple (Pinya)",
    "Watermelon (Pakwan)",
    "Calamansi",
    "Guava (Bayabas)",
    "Rambutan",
    "Lanzones",
    "Durian",
    "Avocado",
    "Dalandan",
    "Jackfruit (Langka)",
    "Star Apple (Kaimito)",
    "Santol",
  ],
  "Egg & Poultry": [
    "Chicken Egg White Pewee (Itlog ng Manok)",
    "Chicken Egg White Extra Small (Itlog ng Manok)",
    "Chicken Egg White Small (Itlog ng Manok)",
    "Chicken Egg White Medium (Itlog ng Manok)",
    "Chicken Egg White Large (Itlog ng Manok)",
    "Chicken Egg White Extra Large (Itlog ng Manok)",
    "Chicken Egg White Jumbo (Itlog ng Manok)",
    "Chicken Egg Brown Medium (Itlog ng Manok)",
    "Chicken Egg Brown Large (Itlog ng Manok)",
    "Chicken Egg Brown Extra Large (Itlog ng Manok)",
    "Duck Egg Small (Itlog ng Pato)",
    "Duck Egg Medium (Itlog ng Pato)",
    "Duck Egg Large (Itlog ng Pato)",
    "Duck Egg Extra Large (Itlog ng Pato)",
    "Duck Egg Jumbo (Itlog ng Pato)",
    "Itik Egg Small (Itlog ng Itik)",
    "Itik Egg Medium (Itlog ng Itik)",
    "Itik Egg Large (Itlog ng Itik)",
    "Itik Egg Extra Large (Itlog ng Itik)",
    "Itik Egg Jumbo (Itlog ng Itik)",
    "Quail Egg (Itlog ng Pugo)",
    "Native Chicken (Manok)",
    "Broiler Chicken",
  ],
  "Rice & Grains": [
    "White Rice (Bigas)",
    "Brown Rice",
    "Red Rice",
    "Glutinous Rice (Malagkit)",
    "White Corn",
    "Yellow Corn (Sweet Corn)",
    "White Corn Grits",
    "Yellow Corn Grits",
  ],
};

// Normalizes a product name so casing and extra spaces do not affect matching.
// Acts as a safety net in case a stored name is not formatted like the values
// coming from the fixed dropdown.
export const normalizeProductName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

// Builds the key used to match a product against the Department of Agriculture
// price table. The Tagalog name in parentheses is dropped so "Eggplant (Talong)"
// becomes "eggplant", "Chicken Egg (Itlog ng Manok)" becomes "chicken egg", and
// "White Rice (Bigas)" becomes "white rice".
export const toCanonicalKey = (name: string): string | null => {
  if (!name) return null;

  const base = name.split("(")[0].trim().toLowerCase().replace(/\s+/g, " ");

  return base || null;
};

// Name prefixes that mark a listing as an egg product.
const EGG_PRODUCT_PREFIXES = ["chicken egg", "duck egg", "quail egg", "itik egg"];

// Checks whether a product name belongs to the egg category.
export const isEggProduct = (productName: string): boolean => {
  const key = toCanonicalKey(productName);
  if (key === null) return false;
  // Matching by prefix keeps per-size entries such as "chicken egg white large"
  // in the egg category, and the full "duck egg" prefix is required so plain
  // "duck" is not treated as an egg.
  return EGG_PRODUCT_PREFIXES.some(
    (prefix) => key === prefix || key.startsWith(prefix + " ")
  );
};

// Returns the units a farmer can pick for a product in this category.
// Everything except eggs is sold "per kg", while Egg & Poultry is sold
// "per tray" or "half tray" only.
export const getUnitsForProduct = (
  category: ProductCategoryKey,
  _productName?: string
): string[] => {
  // Eggs are listed by the tray. The buyer chooses half or full tray when
  // buying, so the farmer only picks one unit here, and "per tray" comes
  // first because it is the default option in Add Harvest.
  if (category === "Egg & Poultry") {
    return ["per tray", "half tray"];
  }

  return ["per kg"];
};

// A farmer lists eggs using a single tray unit, either "half tray" or "per tray",
// while buyers can always choose either option:
//   - Half Tray = 15 pcs
//   - Full Tray (per tray) = 30 pcs
// Both prices are computed from the farmer's base price, so a base of P300 per
// tray becomes half P150 and full P300, while a base of P150 for a half tray
// becomes half P150 and full P300.
// Stock is always deducted in the farmer's base unit, so buying both sizes in
// one order still leaves the inventory correct.

// Half or full egg tray choice.
export type EggVariant = "half" | "full";

// Number of eggs in one half tray.
export const EGG_HALF_PCS = 15;

// Number of eggs in one full tray.
export const EGG_FULL_PCS = 30;

// Unit name stored for a half tray.
export const HALF_TRAY_UNIT = "half tray";

// Unit name stored for a full tray.
export const FULL_TRAY_UNIT = "per tray";

// Rounds an amount to two decimals so prices never show floating point noise.
const roundMoney2 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

// Rounds a stock amount to six decimals so tray fractions stay accurate.
const roundStock6 = (value: number): number =>
  Number(Number(value).toFixed(6));

// Lowercases a unit so tray checks ignore casing and extra spaces.
const normalizeUnit = (unit: string): string =>
  String(unit || "").trim().toLowerCase().replace(/\s+/g, " ");

// Checks whether a unit means a half tray.
export const isHalfTrayUnit = (unit: string): boolean =>
  normalizeUnit(unit) === "half tray";

// Checks whether a unit means a full tray.
export const isFullTrayUnit = (unit: string): boolean => {
  const u = normalizeUnit(unit);
  return u === "per tray" || u === "tray" || u === "full tray";
};

// Checks whether a unit is either tray size.
export const isTrayUnit = (unit: string): boolean =>
  isHalfTrayUnit(unit) || isFullTrayUnit(unit);

// Reads a tray choice from any of its spellings as "half" or "full".
export const normalizeEggVariant = (value: unknown): EggVariant | null => {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "half" || v === "half tray" || v === "half-tray") return "half";
  if (
    v === "full" ||
    v === "per tray" ||
    v === "full tray" ||
    v === "tray"
  )
    return "full";
  return null;
};

// A tray size with its price and egg count, ready for the buyer to choose.
export type EggVariantOption = {
  variant: EggVariant;
  unit: string;
  price: number;
  pcs: number;
  label: string;
};

// Builds the half and full tray options from the farmer's base price.
export const getEggVariantOptions = (
  baseUnit: string,
  basePrice: number
): EggVariantOption[] => {
  if (!isTrayUnit(baseUnit)) return [];
  if (!Number.isFinite(basePrice) || basePrice < 0) return [];

  const halfBase = isHalfTrayUnit(baseUnit);

  return [
    {
      variant: "half",
      unit: HALF_TRAY_UNIT,
      price: halfBase ? roundMoney2(basePrice) : roundMoney2(basePrice / 2),
      pcs: EGG_HALF_PCS,
      label: "Half Tray (15 pcs)",
    },
    {
      variant: "full",
      unit: FULL_TRAY_UNIT,
      price: halfBase ? roundMoney2(basePrice * 2) : roundMoney2(basePrice),
      pcs: EGG_FULL_PCS,
      label: "Full Tray (30 pcs)",
    },
  ];
};

// Converts a quantity the buyer chose into the farmer's base unit, so stock is
// deducted in the unit the farmer listed in. On a "per tray" listing, 2 half
// trays become 1 tray.
export const eggVariantToBaseQuantity = (
  variant: EggVariant | string | null | undefined,
  variantQty: number,
  baseUnit: string
): number => {
  const v = normalizeEggVariant(variant);
  const qty = Number(variantQty);
  if (!v || !Number.isFinite(qty)) return Number(variantQty) || 0;
  if (v === "half" && isFullTrayUnit(baseUnit)) return roundStock6(qty / 2);
  if (v === "full" && isHalfTrayUnit(baseUnit)) return roundStock6(qty * 2);
  return qty;
};

// Converts the farmer's base stock into how much the buyer can add to the cart
// in the tray size they picked. 10 trays become 20 half trays, and 9 half
// trays become 4 full trays because a part of a tray cannot be sold.
export const baseStockToVariantStock = (
  baseStock: number,
  baseUnit: string,
  variant: EggVariant | string | null | undefined
): number => {
  const v = normalizeEggVariant(variant);
  const stock = Number(baseStock);
  if (!Number.isFinite(stock) || stock <= 0) return 0;
  if (!v) return stock;
  if (v === "half" && isFullTrayUnit(baseUnit)) return Math.floor(stock * 2);
  if (v === "full" && isHalfTrayUnit(baseUnit))
    return Math.floor(stock / 2);
  return Math.floor(stock);
};

// Describes the remaining stock in the tray wording the buyer sees. 20 becomes
// "20 trays left", 18.5 becomes "18 and a half trays left", 0.5 becomes
// "Half tray left", and a half tray listing of 50 becomes "50 half trays left".
export const formatTrayStock = (
  baseStock: number,
  baseUnit: string
): string => {
  const stock = Number(baseStock);
  if (!Number.isFinite(stock) || stock <= 0) return "Out of stock";

  if (isHalfTrayUnit(baseUnit)) {
    const n = Math.floor(stock);
    return n === 1 ? "1 half tray left" : `${n} half trays left`;
  }

  if (isFullTrayUnit(baseUnit)) {
    const full = Math.floor(stock);
    const hasHalf = stock - full >= 0.5;
    if (full === 0 && hasHalf) return "Half tray left";
    if (full === 1 && !hasHalf) return "1 tray left";
    if (!hasHalf) return `${full} trays left`;
    return `${full} and a half trays left`;
  }

  return `${stock} ${String(baseUnit || "").trim()} left`;
};

// Returns the label the buyer sees for a tray choice, or an empty string when
// the choice is not a known tray size.
export const eggVariantLabel = (
  variant: EggVariant | string | null | undefined
): string => {
  const v = normalizeEggVariant(variant);
  if (v === "half") return "Half Tray (15 pcs)";
  if (v === "full") return "Full Tray (30 pcs)";
  return "";
};

// Converts the remaining stock into a single egg count so the buyer sees one
// number instead of separate tray counts. 50 half trays equal 750 eggs, and
// 25 full trays also equal 750 eggs.
export const baseStockToPcs = (
  baseStock: number,
  baseUnit: string
): number => {
  const stock = Number(baseStock);
  if (!Number.isFinite(stock) || stock <= 0) return 0;
  if (isHalfTrayUnit(baseUnit)) return Math.floor(stock * EGG_HALF_PCS);
  if (isFullTrayUnit(baseUnit)) return Math.floor(stock * EGG_FULL_PCS);
  return Math.floor(stock);
};