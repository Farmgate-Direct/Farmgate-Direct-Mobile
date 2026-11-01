// Farmer add harvest modal screen.
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CreateProductInput, ProductType, BatchType } from "../../../src/types/product";
import {
  getFarmerProductNames,
  getActiveBatchForHarvest,
} from "../../../src/services/productService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../FirebaseConfig";
import {
  getProductVideoValidationError,
  MAX_PRODUCT_IMAGES,
} from "@/src/constants/productMedia";
import {
  CATEGORIES,
  PRODUCT_CATALOG,
  ProductCategoryKey,
  normalizeProductName,
  toCanonicalKey,
  getUnitsForProduct,
  isEggProduct,
  isHalfTrayUnit,
  isFullTrayUnit,
  EGG_HALF_PCS,
  EGG_FULL_PCS,
} from "@/src/constants/productCatalog";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

// Department of Agriculture reference price, synced into Firestore by
// scripts-automation/da-sync through a GitHub workflow into the
// "da_price_reference" collection. There is no hardcoded table here, so a product
// with no document simply shows no reference.
type DaPriceReference = {
  price: number;
  unit: string;
  source?: string;
  sourceUrl?: string;
  lastUpdated?: any;
};

// Turns a canonical key such as "white rice" into the Firestore document id
// "white-rice". The hyphens matter because that is how da-sync writes it. Duck
// is the one special case, since it is stored as "itik".
const canonicalToDocId = (canonicalKey: string): string => {
  const key = canonicalKey.trim().toLowerCase();
  if (key === "duck") return "itik";
  return key.replace(/\s+/g, "-");
};

// Converts a Department of Agriculture price to half tray or tray for eggs,
// when the reference document is priced per tray or per piece. A standard tray
// holds 30 eggs and a half tray holds 15.
// The catalog lists eggs per size, for example "chicken egg white large" and not
// just "chicken egg", so matching has to work on the prefix like isEggProduct
// does. With an exact match only, a per piece price would never be converted and
// the farmer's real tray price would look too high.
const normalizePriceUnit = (u: string): string =>
  String(u || "").trim().toLowerCase().replace(/\s+/g, " ");

// Checks whether the reference price is per piece or per tray.
const isPcUnit = (u: string): boolean => {
  const n = normalizePriceUnit(u);
  return (
    n === "pc" ||
    n === "pcs" ||
    n === "per pc" ||
    n === "per pcs" ||
    n === "piece" ||
    n === "pieces" ||
    n === "per piece" ||
    n === "piraso"
  );
};

const isTrayPriceUnit = (u: string): boolean => {
  const n = normalizePriceUnit(u);
  return (
    n === "tray" ||
    n === "per tray" ||
    n === "full tray" ||
    n === "per full tray"
  );
};

// Rewrites the reference price into the unit the farmer is listing in.
const adjustDaPriceForUnit = (
  productName: string,
  farmerUnit: string,
  daPrice: DaPriceReference | null
): DaPriceReference | null => {
  if (!daPrice) return daPrice;
  // Vegetables, fruit, and rice need no conversion.
  if (!isEggProduct(productName)) return daPrice;

  const dUnit = normalizePriceUnit(daPrice.unit);

  // A half tray listing against a per tray reference is half the price.
  if (
    isHalfTrayUnit(farmerUnit) &&
    isTrayPriceUnit(dUnit)
  ) {
    return { ...daPrice, price: Math.round(daPrice.price / 2), unit: "half tray" };
  }
  // A per piece reference is multiplied up to the size of the tray.
  if (isPcUnit(dUnit)) {
    if (isFullTrayUnit(farmerUnit)) {
      return { ...daPrice, price: Math.round(daPrice.price * 30), unit: "per tray" };
    }
    if (isHalfTrayUnit(farmerUnit)) {
      return { ...daPrice, price: Math.round(daPrice.price * 15), unit: "half tray" };
    }
  }
  return daPrice;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (
    input: CreateProductInput,
    quantity: number,
    price: number,
    forceNewBatch: boolean
  ) => Promise<void>;
  loading: boolean;
  farmerId: string;
  farmerName: string;
  farmName: string;
};

type DropdownProps = {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
};

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// A plain label with a tappable list of options.
const Dropdown = ({ label, value, options, onSelect, placeholder }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  return (
    <View className="mb-4">
      <Text className="text-xs text-gray-500 mb-1">{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        disabled={options.length === 0}
        className={`flex-row items-center justify-between rounded-[10px] border border-gray-300 px-4 py-3 ${
          options.length === 0 ? "bg-gray-200" : "bg-gray-100"
        }`}
      >
        <Text className={value ? "text-black" : "text-gray-400"}>
          {value || placeholder || `Select ${label.toLowerCase()}`}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} />
      </TouchableOpacity>

      {open && (
        <View className="mt-1 max-h-56 overflow-hidden rounded-[10px] border border-gray-300 bg-white">
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                className={`px-4 py-3 ${opt === value ? "bg-[#14532d]" : "bg-white"}`}
              >
                <Text className={opt === value ? "text-white" : "text-black"}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// Every Save here is a harvest event, not a new product listing.
// When the chosen product already has a batch (currentBatch), the farmer can
// pick one of two options:
//   - "Add to Batch N", which is the default, only adds stock to the current
//     batch and does not change availability.
//   - "Create New Batch", which marks the old batch as Out of Stock even if
//     stock is left in it, so only the new batch is listed and can be bought.
// There is no automatic "a week has passed" rule. The farmer always decides.
const AddProductModal = ({
  visible,
  onClose,
  onSave,
  loading,
  farmerId,
  farmerName,
  farmName,
}: Props) => {
  const [existingProducts, setExistingProducts] = useState<ProductType[]>([]);
  const [category, setCategory] = useState<ProductCategoryKey>("Vegetables");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("per kg");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState("");
  const previewPlayer = useVideoPlayer(video || null, (player) => {
    player.loop = false;
  });
  const { isPlaying: isPreviewPlaying } = useEvent(
    previewPlayer,
    "playingChange",
    { isPlaying: previewPlayer.playing }
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentBatch, setCurrentBatch] = useState<BatchType | null>(null);
  const [forceNewBatch, setForceNewBatch] = useState(false);
  const [matchedProduct, setMatchedProduct] = useState<ProductType | null>(null);
  // Only set when the chosen name and category match an archived product of this
  // farmer. Saving is blocked while it is set, because the farmer has to
  // unarchive the old listing first, otherwise a duplicate listing appears.
  const [archivedDuplicate, setArchivedDuplicate] = useState<ProductType | null>(null);

  // Department of Agriculture suggested price, only a reference, because the
  // farmer still decides the real price.
  const [daPrice, setDaPrice] = useState<DaPriceReference | null>(null);
  const [daPriceRaw, setDaPriceRaw] = useState<DaPriceReference | null>(null);
  const [daLoading, setDaLoading] = useState(false);
  // The farmer's own price per egg for the calculator. It is separate from the
  // price field so there is still a guide even without a DA reference.
  const [eggCalcPc, setEggCalcPc] = useState("");

  useEffect(() => {
    if (visible) {
      // Archived products are included so a matching archived product is found
      // before saving is allowed.
      getFarmerProductNames(farmerId, true).then(setExistingProducts);
    }
  }, [visible, farmerId]);

  useEffect(() => {
    if (!PRODUCT_CATALOG[category]?.includes(name)) {
      setName("");
      setPrice("");
      setDaPrice(null);
      setDaPriceRaw(null);
      setEggCalcPc("");
      // The unit goes back to the default of the category, which is per kg, or per
      // tray for Egg & Poultry since that one is fixed and not chosen.
      setUnit(getUnitsForProduct(category)[0] ?? "per kg");
    }
  }, [category]);

// Checks for an existing product and locks the fields shared by all its batches.
  // When an existing product is picked, the unit, description, and images come
  // from the master document and the price is filled in from its current batch.
  // When the match is an archived product, it stops right there and shows a
  // blocking notice instead.
  useEffect(() => {
    const check = async () => {
      if (!name) {
        setNotice("");
        setCurrentBatch(null);
        setMatchedProduct(null);
        setArchivedDuplicate(null);
        setForceNewBatch(false);
        // With no name yet the unit falls back to the category default, so a leftover
        // egg unit cannot get stuck on a non egg product.
        setUnit((prev) => {
          const def = getUnitsForProduct(category)[0] ?? "per kg";
          const allowed = getUnitsForProduct(category);
          return allowed.includes(prev) ? prev : def;
        });
        return;
      }
      const target = normalizeProductName(name);
      const match = existingProducts.find(
        (p) => normalizeProductName(p.name) === target && p.category === category
      );

      if (match?.archived) {
        setArchivedDuplicate(match);
        setMatchedProduct(null);
        setCurrentBatch(null);
        setNotice("");
        return;
      }

      setArchivedDuplicate(null);
      setForceNewBatch(false);

      if (match) {
        setMatchedProduct(match);
        setUnit(match.unit);
        setDescription(match.description);
        setImages(
          match.images?.length
            ? match.images
            : !match.video && match.image
              ? [match.image]
              : []
        );
        setVideo(match.video || "");

        // The newest batch, whatever its date, which is where the add here or create a
        // new one choice starts.
        const batch = await getActiveBatchForHarvest(match.docId);
        setCurrentBatch(batch);

        if (batch) {
          setPrice(batch.price.toString());
          const batchDate = (batch as any).weekStart ?? batch.createdAt;
          setNotice(
            `Batch ${String(batch.batchNumber).padStart(3, "0")} (${formatDate(batchDate)}) - ${batch.stock} ${match.unit} available, status: ${batch.status}. Choose below whether to add to this batch or create a new one.`
          );
        } else {
          setNotice("This is the first harvest for this product — creating the first batch.");
        }
      } else {
        setMatchedProduct(null);
        setNotice("");
        setCurrentBatch(null);
        // A new product starts with clean fields. The unit is fixed per category, so
        // Egg & Poultry is per tray because the buyer picks half or full, and
        // everything else is per kg.
        setUnit(getUnitsForProduct(category, name)[0] ?? "per kg");
        setDescription("");
        setImages([]);
        setVideo("");
        setPrice("");
      }
    };
    check();
  }, [name, category, existingProducts]);

  // Looks up the Department of Agriculture price in the "da_price_reference"
  // collection, which is written by the scripts-automation/da-sync GitHub
  // workflow. It is only a reference and never blocks saving. When there is no
  // document, for example because the automation has not synced it yet, no
  // reference is shown.
  useEffect(() => {
    if (!name) {
      setDaPrice(null);
      setDaPriceRaw(null);
      setDaLoading(false);
      return;
    }

    const canonicalKey = toCanonicalKey(name);
    if (!canonicalKey) {
      setDaPrice(null);
      setDaPriceRaw(null);
      setDaLoading(false);
      return;
    }

    let cancelled = false;

    const loadDaPrice = async () => {
      try {
        setDaLoading(true);
        setDaPrice(null);
        setDaPriceRaw(null);

        const docId = canonicalToDocId(canonicalKey);
        const snap = await getDoc(doc(db, "da_price_reference", docId));

        if (cancelled) return;

        if (!snap.exists()) {
          setDaPrice(null);
          setDaPriceRaw(null);
          return;
        }

        const data = snap.data() as {
          price?: number;
          unit?: string;
          source?: string;
          sourceUrl?: string;
          lastUpdated?: any;
        };

        const rawPrice = Number(data.price);
        if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
          setDaPrice(null);
          setDaPriceRaw(null);
          return;
        }

        const fetched: DaPriceReference = {
          price: rawPrice,
          unit: (data.unit || "kg").trim() || "kg",
          source: data.source,
          sourceUrl: data.sourceUrl,
          lastUpdated: data.lastUpdated,
        };

        // Converted to half tray or tray when needed for eggs. The price exactly as
        // fetched is kept in daPriceRaw as well, because the half and full tray
        // suggestion below is calculated from it.
        setDaPriceRaw(fetched);
        setDaPrice(adjustDaPriceForUnit(name, unit, fetched));
      } catch (err) {
        getUserFriendlyErrorMessage(err, "Load farmer reference prices");
        if (!cancelled) setDaPrice(null);
        if (!cancelled) setDaPriceRaw(null);
      } finally {
        if (!cancelled) setDaLoading(false);
      }
    };

    loadDaPrice();

    return () => {
      cancelled = true;
    };
  }, [name, unit]);

  const productNameOptions = PRODUCT_CATALOG[category] || [];
  const unitOptions = getUnitsForProduct(category, name || undefined);
  const isExistingProduct = matchedProduct !== null;
  // The choice only appears when a batch already exists. On the very first
  // harvest there is no batch yet, so nothing needs to be chosen.
  const showBatchChoice = currentBatch !== null;

  // A comparison against the reference price, which only warns when the farmer
  // asks more than the suggestion.
  const numericPrice = Number(price);
  const priceExceedsDaSuggestion =
    daPrice !== null &&
    Number.isFinite(numericPrice) &&
    numericPrice > 0 &&
    numericPrice > daPrice.price;

  // When the reference price is per egg, the half tray of 15 eggs and the full
  // tray of 30 eggs are worked out from the price exactly as fetched, before it
  // is converted to the chosen unit.
  const eggTraySuggestion =
    daPriceRaw !== null &&
    isPcUnit(daPriceRaw.unit) &&
    isEggProduct(name)
      ? {
          perPc: daPriceRaw.price,
          halfTray: Math.round(daPriceRaw.price * 15),
          fullTray: Math.round(daPriceRaw.price * 30),
        }
      : null;

  // The farmer's own calculation. Even without a reference price the farmer sees
  // the numbers worked out from their own price, so half tray of 15 eggs and
  // full tray of 30 eggs stay easy to understand.
  const formatEggPeso = (v: number) =>
    Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);

  const eggFarmerHelper =
    isEggProduct(name) && Number.isFinite(numericPrice) && numericPrice > 0
      ? unit.trim().toLowerCase() === "per tray"
        ? {
            perPc: numericPrice / 30,
            halfTray: numericPrice / 2,
            fullTray: numericPrice,
          }
        : unit.trim().toLowerCase() === "half tray"
          ? {
              perPc: numericPrice / 15,
              halfTray: numericPrice,
              fullTray: numericPrice * 2,
            }
          : null
      : null;

  // The egg calculator is always available for eggs, with or without a reference
  // price. The farmer types a price per egg and the half tray of 15 eggs and the
  // full tray of 30 eggs are worked out automatically.
  const eggCalcPcValue = Number(eggCalcPc);
  const eggCalcResult =
    isEggProduct(name) &&
    eggCalcPc !== "" &&
    Number.isFinite(eggCalcPcValue) &&
    eggCalcPcValue > 0
      ? {
          halfTray: Math.round(eggCalcPcValue * 15),
          fullTray: Math.round(eggCalcPcValue * 30),
        }
      : null;

  // Copies the calculator result into the price field. The unit for Egg & Poultry
  // is fixed as per tray, so only the full tray price is set.
  const applyEggCalc = () => {
    if (!eggCalcResult || isExistingProduct) return;
    setPrice(String(eggCalcResult.fullTray));
    setUnit("per tray");
  };

  const isFormValid =
    !archivedDuplicate &&
    name.trim() !== "" &&
    category.trim() !== "" &&
    price !== "" &&
    quantity !== "" &&
    unit.trim() !== "" &&
    description.trim() !== "" &&
    (images.length > 0 || video !== "");

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PRODUCT_IMAGES - images.length,
    });
    if (!result.canceled && result.assets?.length) {
      setError("");
      setImages((current) =>
        [...current, ...result.assets.map((asset) => asset.uri).filter(Boolean)]
          .slice(0, MAX_PRODUCT_IMAGES)
      );
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 20,
      quality: 0.5,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const validationError = getProductVideoValidationError(asset);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setVideo(asset.uri);
  };

  const handlePriceChange = (text: string) => {
    if (/^\d*$/.test(text)) setPrice(text);
  };

  const handleQuantityChange = (text: string) => {
    if (/^\d*$/.test(text)) setQuantity(text);
  };

  const resetForm = () => {
    setCategory("Vegetables");
    setName("");
    setPrice("");
    setUnit("per kg");
    setQuantity("");
    setDescription("");
    setImages([]);
    setVideo("");
    setNotice("");
    setCurrentBatch(null);
    setMatchedProduct(null);
    setArchivedDuplicate(null);
    setForceNewBatch(false);
    setDaPrice(null);
    setDaPriceRaw(null);
    setDaLoading(false);
    setEggCalcPc("");
  };

// Validate and save the harvest entry.
  const handleSave = async () => {
    if (archivedDuplicate) {
      setError(
        `You already have an archived "${archivedDuplicate.name}". Unarchive it first before adding a new harvest.`
      );
      return;
    }
    if (!isFormValid) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");

    const input: CreateProductInput = {
      name,
      category,
      unit,
      description,
      image: images[0] || "",
      imagePublicId: "",
      images,
      video,
      farmerId,
      farmerName,
      farmName,
      rating: 0,
      totalReviews: 0,
      totalSales: 0,
      weeklySales: 0,
      monthlySales: 0,
      createdAt: Date.now(),
      price: 0,
      stock: 0,
      status: "Available",
      archived: false,
    };

    try {
      await onSave(input, Number(quantity), Number(price), forceNewBatch);
      resetForm();
      onClose();
    } catch (err) {
      setError(
        getUserFriendlyErrorMessage(
          err,
          "Save farmer harvest",
          "We couldn't save this harvest right now. Please try again in a moment."
        )
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 justify-center bg-black/40 px-6">
        <View className="max-h-[90%] rounded-[10px] bg-white p-5">
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-lg font-bold mb-4">Add Harvest</Text>

            {error ? <Text className="text-red-500 mb-3">{error}</Text> : null}

            {/* Shown when an archived product with the same name blocks saving. */}
            {archivedDuplicate ? (
              <View className="mb-4 rounded-[10px] border border-orange-300 bg-orange-50 px-4 py-3">
                <Text className="text-orange-700 text-xs font-semibold mb-1">
                  You already have an archived product with this name
                </Text>
                <Text className="text-orange-700 text-xs">
                  &quot;{archivedDuplicate.name}&quot; ({archivedDuplicate.category}) is archived.
                  Go to the &quot;Archived&quot; tab in the listing and unarchive it before adding a
                  new harvest.
                </Text>
              </View>
            ) : notice ? (
              <View className="mb-4 rounded-[10px] border border-green-200 bg-green-50 px-4 py-3">
                <Text className="text-green-700 text-xs">{notice}</Text>
              </View>
            ) : null}

            <Dropdown
              label="CATEGORY"
              value={category}
              options={[...CATEGORIES]}
              onSelect={(v) => setCategory(v as ProductCategoryKey)}
            />

            <Dropdown
              label="PRODUCT NAME"
              value={name}
              options={productNameOptions}
              onSelect={setName}
              placeholder="Select product"
            />

            {/* Batch choice, shown only when a batch really exists. Nothing is chosen
                automatically based on the week, the farmer always decides. */}
            {showBatchChoice && currentBatch && (
              <View className="mb-4">
                <Text className="text-xs text-gray-500 mb-2">
                  WHAT WOULD YOU LIKE TO DO WITH THIS NEW HARVEST?
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setForceNewBatch(false)}
                    className={`flex-1 rounded-[10px] border px-3 py-3 ${
                      !forceNewBatch
                        ? "bg-[#14532d] border-[#14532d]"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold text-center ${
                        !forceNewBatch ? "text-white" : "text-gray-700"
                      }`}
                    >
                      Add to Batch {String(currentBatch.batchNumber).padStart(3, "0")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setForceNewBatch(true)}
                    className={`flex-1 rounded-[10px] border px-3 py-3 ${
                      forceNewBatch
                        ? "bg-[#14532d] border-[#14532d]"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold text-center ${
                        forceNewBatch ? "text-white" : "text-gray-700"
                      }`}
                    >
                      Create New Batch
                    </Text>
                  </TouchableOpacity>
                </View>
                {forceNewBatch && (
                  <Text className="text-orange-600 text-[10px] mt-2">
                    Batch {String(currentBatch.batchNumber).padStart(3, "0")} will become
                    &quot;Out of Stock&quot; (even if stock remains) — only the new batch will be
                    visible and buyable to buyers.
                  </Text>
                )}
              </View>
            )}

            {/* The unit is locked and the farmer cannot pick it. A new Egg & Poultry
                product is fixed to "per tray", because the buyer chooses half
                tray (15 pcs) or full tray (30 pcs). An existing product keeps
                the unit of its master listing. */}
            {isExistingProduct || category === "Egg & Poultry" ? (
              <View className="mb-4">
                <Text className="text-xs text-gray-500 mb-1">UNIT</Text>
                <View className="rounded-[10px] border border-gray-200 bg-gray-100 px-4 py-3">
                  <Text className="text-gray-500">{unit}</Text>
                </View>
                {category === "Egg & Poultry" && !isExistingProduct && (
                  <Text className="text-gray-400 text-[10px] mt-1">
                    Enter the price and quantity per full tray (30 pcs). Buyers will
                    choose half tray (15 pcs) or full tray in the shop — the price is
                    calculated automatically (half = half price).
                  </Text>
                )}
              </View>
            ) : (
              <Dropdown
                label="UNIT"
                value={unit}
                options={unitOptions}
                onSelect={setUnit}
              />
            )}

            {/* The price is always editable and always shows its unit, so it stays clear
                what the price is per full tray, per kilo, and so on. */}
            <Text className="text-xs text-gray-500 mb-1">
              PRICE (₱ per {unit.replace(/^per\s+/i, "")})
            </Text>
            <TextInput
              value={price}
              onChangeText={handlePriceChange}
              keyboardType="numeric"
              placeholder="Enter price"
              className="mb-2 rounded-[10px] border border-gray-300 bg-gray-100 px-4 py-3 text-gray-800"
            />

            {/* The farmer's own breakdown, shown for eggs once a price is typed, with
                or without a Department of Agriculture reference. */}
            {eggFarmerHelper && (
              <View className="mb-2 rounded-[10px] border border-green-200 bg-green-50 px-4 py-3">
                <Text className="text-green-800 text-xs font-semibold mb-1">
                  Your price breakdown (₱{Number(price).toLocaleString()} per {unit.replace(/^per\s+/i, "")}):
                </Text>
                <Text className="text-green-800 text-xs">
                  • Each egg: ₱{formatEggPeso(eggFarmerHelper.perPc)}{"\n"}• Half tray (15 eggs): ₱{formatEggPeso(eggFarmerHelper.halfTray)}{"\n"}• Full tray (30 eggs): ₱{formatEggPeso(eggFarmerHelper.fullTray)}
                </Text>
              </View>
            )}

            {/* The egg calculator is always shown for eggs, even with no reference
                price and no price typed yet. It helps the farmer work out the
                half and full tray prices. */}
            {isEggProduct(name) && (
              <View className="mb-2 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
                <Text className="text-amber-800 text-xs font-semibold mb-1">
                  Egg calculator
                </Text>
                <Text className="text-xs text-gray-500 mb-1">
                  PRICE PER EGG (₱)
                </Text>
                <TextInput
                  value={eggCalcPc}
                  onChangeText={(text) => {
                    if (/^\d*\.?\d*$/.test(text)) setEggCalcPc(text);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Hal. 8.50"
                  className="mb-2 rounded-[10px] border border-gray-300 bg-white px-4 py-2 text-gray-800"
                />
                {eggCalcResult ? (
                  <View>
                    <Text className="text-amber-800 text-xs">
                      • Half tray (15 eggs): ₱{Number(eggCalcResult.halfTray).toLocaleString()}{"\n"}• Full tray (30 eggs): ₱{Number(eggCalcResult.fullTray).toLocaleString()}
                    </Text>
                    {!isExistingProduct && (
                      <View className="mt-2">
                        <TouchableOpacity
                          onPress={applyEggCalc}
                          className="items-center rounded-[5px] bg-[#14532d] py-3"
                        >
                          <Text className="text-white text-xs font-semibold">
                            Use: ₱{Number(eggCalcResult.fullTray).toLocaleString()} per tray
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text className="text-gray-400 text-[10px]">
                    Enter the price per egg to see the half/full tray values.
                  </Text>
                )}
              </View>
            )}

            {daLoading && name ? (
              <View className="mb-2 rounded-[10px] border border-gray-200 bg-gray-50 px-4 py-3">
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text className="text-gray-500 text-xs ml-2">
                    Fetching the latest DA market reference...
                  </Text>
                </View>
              </View>
            ) : daPrice ? (
              <View className="mb-2 rounded-[10px] border border-blue-200 bg-blue-50 px-4 py-3">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="information-circle" size={16} color="#1D4ED8" />
                  <Text className="text-blue-800 text-xs font-semibold ml-1">
                    Suggested Market Price (DA)
                  </Text>
                </View>
                <Text className="text-blue-800 text-sm mb-1">
                  ₱{Number(daPrice.price).toLocaleString()} per {daPrice.unit}
                </Text>
                {eggTraySuggestion && (
                  <View className="mt-2 rounded-[8px] bg-blue-100/60 px-3 py-2">
                    <Text className="text-blue-800 text-xs font-semibold mb-1">
                      Tray estimate (based on ₱{Number(eggTraySuggestion.perPc).toLocaleString()} per egg):
                    </Text>
                    <Text className="text-blue-800 text-xs">
                      • Half tray (15 eggs): ₱{Number(eggTraySuggestion.halfTray).toLocaleString()}{"\n"}• Full tray (30 eggs): ₱{Number(eggTraySuggestion.fullTray).toLocaleString()}
                    </Text>
                  </View>
                )}
                <Text className="text-blue-600 text-[10px]">
                  This is only a reference from the Department of Agriculture
                  {daPrice.lastUpdated?.toDate
                    ? ` (updated ${daPrice.lastUpdated.toDate().toLocaleDateString()})`
                    : ""}
                  . You are free to set your own selling price.
                </Text>
              </View>
            ) : name ? (
              <View className="mb-2 rounded-[10px] border border-gray-200 bg-gray-50 px-4 py-3">
                <Text className="text-gray-500 text-xs">
                  There is no available DA reference for this product right now.
                </Text>
              </View>
            ) : null}

            {priceExceedsDaSuggestion && (
              <View className="mb-4 rounded-[10px] border border-orange-300 bg-orange-50 px-4 py-3">
                <View className="flex-row items-start">
                  <Ionicons name="warning" size={16} color="#C2410C" />
                  <Text className="text-orange-700 text-xs ml-2 flex-1">
                    Your entered price is higher than the latest suggested market
                    price from the Department of Agriculture (DA).{"\n\n"}
                    The DA price is only a reference — you can still continue posting
                    using your own price.
                  </Text>
                </View>
              </View>
            )}

            {/* The quantity is asked directly so it stays clear what is being counted,
                whether that is a full tray, a half tray, or a kilo. For eggs
                the total number of pieces is shown as well. */}
            <Text className="text-xs text-gray-500 mb-1">
              HARVEST QUANTITY
            </Text>
            <Text className="text-gray-400 text-[11px] mb-1">
              {isEggProduct(name) && isFullTrayUnit(unit)
                ? "How many full trays (30 pcs each) did you harvest?"
                : isEggProduct(name) && isHalfTrayUnit(unit)
                  ? "How many half trays (15 pcs each) did you harvest?"
                  : `How many ${unit.replace(/^per\s+/i, "")} units did you harvest?`}
            </Text>
            <TextInput
              value={quantity}
              onChangeText={handleQuantityChange}
              keyboardType="numeric"
              placeholder="Ex. 50"
              className="mb-1 rounded-[10px] border border-gray-300 bg-gray-100 px-4 py-3 text-gray-800"
            />
            {isEggProduct(name) &&
            (isHalfTrayUnit(unit) || isFullTrayUnit(unit)) &&
            quantity !== "" &&
            Number(quantity) > 0 ? (
              <Text className="text-green-700 text-xs mb-4 mt-1">
                Total eggs:{" "}
                {(
                  Number(quantity) *
                  (isHalfTrayUnit(unit) ? EGG_HALF_PCS : EGG_FULL_PCS)
                ).toLocaleString()}{" "}
                pcs
              </Text>
            ) : (
              <View className="mb-3" />
            )}

            {/* The description can only be filled in for a new product. */}
            <Text className="text-xs text-gray-500 mb-1">DESCRIPTION</Text>
            {isExistingProduct ? (
              <View className="mb-1 rounded-[10px] border border-gray-200 bg-gray-100 px-4 py-3">
                <Text className="text-gray-500 text-sm">{description || "—"}</Text>
              </View>
            ) : (
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Describe product..."
                className="mb-1 h-24 rounded-[10px] border border-gray-300 bg-gray-100 px-4 py-3 text-gray-800"
              />
            )}
            {isExistingProduct && (
              <Text className="text-gray-400 text-[10px] mb-4">
                This product shares its information — use &quot;Edit Product&quot; to change it.
              </Text>
            )}
            {!isExistingProduct && <View className="mb-3" />}

            <Text className="text-xs text-gray-500 mb-1">
              PRODUCT MEDIA
            </Text>
            {isExistingProduct ? (
              <View className="mb-1 rounded-[10px] border border-gray-200 bg-gray-100 p-3">
                {(images.length > 0 || video) ? (
                  <View>
                    {video ? (
                      <View className={images.length > 0 ? "mb-2" : ""}>
                        <View className="relative h-44 w-full overflow-hidden rounded-[10px] bg-black">
                          <VideoView
                            player={previewPlayer}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="contain"
                            nativeControls={false}
                          />
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={
                              isPreviewPlaying
                                ? "Pause product video"
                                : "Play product video"
                            }
                            onPress={() =>
                              isPreviewPlaying
                                ? previewPlayer.pause()
                                : previewPlayer.play()
                            }
                            className="absolute inset-0 items-center justify-center"
                          >
                            <View className="h-12 w-12 items-center justify-center rounded-full bg-black/50">
                              <Ionicons
                                name={isPreviewPlaying ? "pause" : "play"}
                                size={24}
                                color="white"
                              />
                            </View>
                          </TouchableOpacity>
                        </View>
                        <Text className="mt-1 text-sm text-gray-600">
                          Product video already added
                        </Text>
                      </View>
                    ) : null}
                    {images.length > 0 && (
                      <View className="flex-row flex-wrap gap-2">
                        {images.map((uri, index) => (
                          <Image
                            key={`${uri}-${index}`}
                            source={{ uri }}
                            className="h-16 w-16 rounded-[10px]"
                          />
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <Text className="text-gray-500">No media selected</Text>
                )}
              </View>
            ) : (
              <View className="mb-1 rounded-[10px] border border-gray-300 bg-gray-50 p-3">
                {video ? (
                  <View className="mb-3">
                    <View className="relative h-44 w-full overflow-hidden rounded-[10px] bg-black">
                      <VideoView
                        player={previewPlayer}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="contain"
                        nativeControls={false}
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={
                          isPreviewPlaying
                            ? "Pause product video"
                            : "Play product video"
                        }
                        onPress={() =>
                          isPreviewPlaying
                            ? previewPlayer.pause()
                            : previewPlayer.play()
                        }
                        className="absolute inset-0 items-center justify-center"
                      >
                        <View className="h-12 w-12 items-center justify-center rounded-full bg-black/50">
                          <Ionicons
                            name={isPreviewPlaying ? "pause" : "play"}
                            size={24}
                            color="white"
                          />
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel="Remove video"
                        onPress={() => {
                          previewPlayer.pause();
                          setVideo("");
                        }}
                        className="absolute right-2 top-2"
                      >
                        <Ionicons
                          name="close-circle"
                          size={24}
                          color="#dc2626"
                        />
                      </TouchableOpacity>
                    </View>
                    <Text className="mt-1 text-sm text-gray-700">
                      20-second product video selected
                    </Text>
                  </View>
                ) : null}
                {images.length > 0 && (
                  <View className="mb-3 flex-row flex-wrap gap-2">
                    {images.map((uri, index) => (
                      <View key={`${uri}-${index}`}>
                        <Image
                          source={{ uri }}
                          className="h-16 w-16 rounded-[10px]"
                        />
                        <TouchableOpacity
                          accessibilityLabel={`Remove image ${index + 1}`}
                          onPress={() =>
                            setImages((current) =>
                              current.filter((_, imageIndex) => imageIndex !== index)
                            )
                          }
                          className="absolute -right-1 -top-1"
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color="#dc2626"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={pickImages}
                    disabled={images.length >= MAX_PRODUCT_IMAGES}
                    className="flex-1 items-center rounded-[10px] border border-[#14532d] px-2 py-3"
                  >
                    <Text className="text-center text-xs font-semibold text-[#14532d]">
                      Add images ({images.length}/{MAX_PRODUCT_IMAGES})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={pickVideo}
                    disabled={video !== ""}
                    className="flex-1 items-center rounded-[10px] border border-[#14532d] px-2 py-3"
                  >
                    <Text className="text-center text-xs font-semibold text-[#14532d]">
                      Add 20-sec video
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text className="mt-2 text-[10px] text-gray-500">
                  Add up to 5 images and 1 video (20 seconds, 25 MB max).
                </Text>
              </View>
            )}
            {isExistingProduct && (
              <Text className="text-gray-400 text-[10px] mb-6">
                This product shares its media — use &quot;Edit Product&quot; to change it.
              </Text>
            )}
            {!isExistingProduct && <View className="mb-5" />}

            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  onClose();
                }}
                className="w-[48%] items-center rounded-[10px] border border-[#14532d] py-3"
              >
                <View className="items-center justify-center">
                  <Text className="font-semibold text-[#14532d]">Cancel</Text>
                  <Text className="text-[10px] text-[#14532d]">(Kanselahin)</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={!isFormValid || loading}
                className="w-[48%] items-center rounded-[10px] py-3"
                style={{
                  backgroundColor:
                    isFormValid && !loading ? "#14532d" : "#9ca3af",
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View className="items-center justify-center">
                    <Text className="text-white font-bold">Save</Text>
                    <Text className="text-[10px] text-white/80">(I-save)</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default AddProductModal;
