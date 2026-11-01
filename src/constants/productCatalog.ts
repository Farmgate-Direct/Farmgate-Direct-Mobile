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

// Common unit suggestions. Farmers may also enter a custom unit per variation.
export const getUnitsForProduct = (
  _category: ProductCategoryKey,
  _productName?: string
): string[] => [
  "per kg",
  "per piece",
  "per bundle",
  "per dozen",
  "per tray",
  "per pack",
  "per box",
];