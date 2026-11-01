// Farmer product list and batch manager screen.
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import AddProductModal from "../../farmer/products/add-product";
import EditProductModal from "../../farmer/products/edit-product";
import EditBatchModal from "../../farmer/products/edit-batch";
import DeleteProductModal from "../../farmer/products/delete-product";
import RecordSaleModal from "../../farmer/products/record-sale";

import { deleteCartItemsByProductId } from "../../../src/services/cartService";

import {
  ProductType,
  CreateProductInput,
  BatchType,
  HarvestRecordType,
} from "../../../src/types/product";

import { deleteCloudinaryImage } from "../../../src/services/deleteImageService";

import {
  addHarvest,
  archiveProduct,
  unarchiveProduct,
  archiveBatch,
  unarchiveBatch,
  getFarmerProducts,
  getArchivedProducts,
  getBatchesByProduct,
  getHarvestRecordsByBatch,
  updateProductInfo,
  updateBatch,
  recordSale,
} from "../../../src/services/productService";

import {
  uploadImageAsync,
  uploadProductVideoAsync,
} from "../../../src/services/cloudinaryService";
import { useToast } from "@/src/context/ToastContext";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";
import FarmerTutorialVideoModal from "@/src/components/FarmerTutorialVideoModal";
import {
  getFarmerScreenBottomPadding,
  getFarmerTabBarClearance,
} from "@/src/constants/farmerLayout";

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const getVideoThumbnailUrl = (videoUrl: string) =>
  videoUrl
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.[^/.]+$/, ".jpg");

// Upload product photos and video before saving.
const uploadProductMedia = async (product: {
  image: string;
  imagePublicId: string;
  images?: string[];
  imagePublicIds?: string[];
  video?: string;
  videoPublicId?: string;
}) => {
  const images = product.images?.length
    ? product.images
    : !product.video && product.image
      ? [product.image]
      : [];
  const uploadedImages = await Promise.all(
    images.map(async (uri, index) => {
      if (uri.startsWith("https://")) {
        return {
          imageUrl: uri,
          publicId:
            product.imagePublicIds?.[index] ||
            (index === 0 ? product.imagePublicId : ""),
        };
      }
      return uploadImageAsync(uri);
    })
  );

  let video = product.video || "";
  let videoPublicId = video ? product.videoPublicId || "" : "";
  if (video && !video.startsWith("https://")) {
    const uploadedVideo = await uploadProductVideoAsync(video);
    video = uploadedVideo.videoUrl;
    videoPublicId = uploadedVideo.publicId;
  }

  return {
    image:
      uploadedImages[0]?.imageUrl ||
      (video ? getVideoThumbnailUrl(video) : ""),
    imagePublicId: uploadedImages[0]?.publicId || "",
    images: uploadedImages.map((item) => item.imageUrl),
    imagePublicIds: uploadedImages.map((item) => item.publicId),
    video,
    videoPublicId,
  };
};

type ViewMode = "active" | "archived";

// Filter options share the farm profile sort design.
const FILTER_OPTIONS = [
  { value: "active", label: "Active", icon: "leaf-outline" },
  { value: "archived", label: "Archive", icon: "archive-outline" },
  { value: "low_stock", label: "Low stock", icon: "warning-outline" },
  { value: "out_of_stock", label: "Out of stock", icon: "ban-outline" },
] as const;

type ProductScreenProps = {
  detailProductId?: string;
  initialViewMode?: ViewMode;
};

type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
};

export const ProductScreen = ({
  detailProductId,
  initialViewMode,
}: ProductScreenProps = {}) => {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { filter: routeFilter } = useLocalSearchParams<{ filter?: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialViewMode || "active"
  );
  const [listFilter, setListFilter] = useState<
    "active" | "archived" | "low_stock" | "out_of_stock"
  >(initialViewMode === "archived" ? "archived" : "active");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showProductsTutorial, setShowProductsTutorial] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const sortButtonRef = useRef<View>(null);

  // Position the modal below the button.
  const openSortDropdown = () => {
    sortButtonRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      setDropdownPos({
        top: y + height + 6,
        right: screenWidth - (x + width),
      });
      setShowFilterModal(true);
    });
  };

  const [products, setProducts] = useState<ProductType[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<ProductType[]>([]);

  // Include archived batches here and separate them in the UI.
  const [batchesByProduct, setBatchesByProduct] = useState<
    Record<string, BatchType[]>
  >({});

  const [harvestsByBatch, setHarvestsByBatch] = useState<
    Record<string, HarvestRecordType[]>
  >({});

  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);

  const [selectedProduct, setSelectedProduct] =
    useState<ProductType | null>(null);

  const [selectedBatch, setSelectedBatch] = useState<BatchType | null>(null);
  const [selectedBatchUnit, setSelectedBatchUnit] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [showRecordSaleModal, setShowRecordSaleModal] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const [recordingSale, setRecordingSale] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("user").then((data) => {
      if (data) {
        setUser(JSON.parse(data));
      }
    });
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const [active, archived] = await Promise.all([
        getFarmerProducts(user.uid),
        getArchivedProducts(user.uid),
      ]);

      setProducts(active);
      setArchivedProducts(archived);

      // Include archived batches for display in the UI.
      const allProducts = [...active, ...archived];

      const batchEntries = await Promise.all(
        allProducts.map(
          async (p) =>
            [
              p.docId,
              await getBatchesByProduct(p.docId, true),
            ] as const
        )
      );

      setBatchesByProduct(Object.fromEntries(batchEntries));
    } catch (error) {
      getUserFriendlyErrorMessage(error, "Load farmer products");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void fetchProducts();
    }
  }, [user, fetchProducts]);

  useEffect(() => {
    if (
      !detailProductId &&
      (routeFilter === "low_stock" || routeFilter === "out_of_stock")
    ) {
      setViewMode("active");
      setListFilter(routeFilter);
    }
  }, [detailProductId, routeFilter]);

// Load active and archived products with batches.
  // Always load the latest harvest records.
  const loadHarvestsForBatch = async (batchId: string) => {
    try {
      const records = await getHarvestRecordsByBatch(batchId);

      setHarvestsByBatch((prev) => ({
        ...prev,
        [batchId]: records,
      }));
    } catch (error) {
      getUserFriendlyErrorMessage(error, "Load farmer harvest history");
    }
  };

  const getActiveBatches = (docId: string) =>
    (batchesByProduct[docId] || []).filter((b) => !b.archived);

  const getArchivedBatches = (docId: string) =>
    (batchesByProduct[docId] || []).filter((b) => b.archived);

  const getTotalStock = (docId: string) =>
    getActiveBatches(docId)
      .filter(
        (b) =>
          b.archived !== true &&
          Number(b.stock) > 0 &&
          b.status === "Available"
      )
      .reduce(
        (sum, b) => sum + Number(b.stock || 0),
        0
      );

  // The current selling batch is the newest active batch.
  const getCurrentSellingBatch = (docId: string) => {
    const batches = getActiveBatches(docId)
      .filter(
        (b) =>
          b.archived !== true &&
          Number(b.stock) > 0 &&
          b.status === "Available"
      )
      .sort(
        (a, b) =>
          Number(a.batchNumber) -
          Number(b.batchNumber)
      );

    return batches[0] || null;
  };

// Save a new harvest as product or batch stock.
  const handleAddProduct = async (
    product: CreateProductInput,
    quantity: number,
    price: number,
    forceNewBatch: boolean
  ) => {
    try {
      setUploading(true);

      const media = await uploadProductMedia(product);

      const newProduct: CreateProductInput = {
        ...product,
        ...media,
        farmerId: user.uid,
        farmerName: user.fullName,
        farmName: user.farmName,
      };

      const { batch } = await addHarvest(
        newProduct,
        quantity,
        price,
        forceNewBatch
      );

      await fetchProducts();

      await loadHarvestsForBatch(batch.docId);

      setShowAddModal(false);
    } catch (err) {
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleEditProduct = async (product: ProductType) => {
    try {
      setEditing(true);

      const media = await uploadProductMedia(product);

      await updateProductInfo({
        ...product,
        ...media,
      });

      const previousImageIds =
        product.imagePublicIds?.length
          ? product.imagePublicIds
          : product.imagePublicId
            ? [product.imagePublicId]
            : [];
      const retainedImageIds = new Set(media.imagePublicIds);
      await Promise.all(
        previousImageIds
          .filter((publicId) => publicId && !retainedImageIds.has(publicId))
          .map(deleteCloudinaryImage)
      );

      await fetchProducts();

      setShowEditModal(false);
    } catch (err) {
      throw err;
    } finally {
      setEditing(false);
    }
  };

  // Product price, status, and restock quantity.
  // The price applies to the whole product and all batches.
  const handleSaveBatch = async (
    batchDocId: string,
    updates: {
      price: number;
      status: string;
      restockQuantity: number;
    }
  ) => {
    setSavingBatch(true);

    try {
      await updateBatch(batchDocId, updates);

      await fetchProducts();

      setShowEditBatchModal(false);

      // Refresh the harvest list when the batch is open.
      if (expandedBatchId === batchDocId) {
        await loadHarvestsForBatch(batchDocId);
      }
    } catch (error) {
      throw error;
    } finally {
      setSavingBatch(false);
    }
  };

// Save walk-in sale and refresh stock.
  const handleRecordSale = async (quantity: number) => {
    if (!selectedProduct?.docId) return;

    setRecordingSale(true);

    try {
      await recordSale(selectedProduct.docId, quantity);

      await fetchProducts();

      setShowRecordSaleModal(false);
    } catch (err) {
      throw err;
    } finally {
      setRecordingSale(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct?.docId) return;

    try {
      setDeleting(true);

      await archiveProduct(selectedProduct.docId);

      await deleteCartItemsByProductId(selectedProduct.docId);

      await fetchProducts();

      setShowDeleteModal(false);
    } catch (err) {
      showToast(
        getUserFriendlyErrorMessage(
          err,
          "Archive farmer product",
          "We couldn't update this product right now. Please try again."
        )
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleUnarchiveProduct = (product: ProductType) => {
    setConfirmation({
      title: "Unarchive Product",
      message: `Return "${product.name}" to the listing? Buyers will be able to see it again.`,
      confirmLabel: "Unarchive",
      onConfirm: async () => {
        try {
          await unarchiveProduct(product.docId);

          await fetchProducts();
        } catch (err) {
          showToast(
            getUserFriendlyErrorMessage(
              err,
              "Unarchive farmer product",
              "We couldn't update this product right now. Please try again."
            )
          );
        }
      },
    });
  };

  const handleArchiveBatchPress = (batch: BatchType) => {
    setConfirmation({
      title: "Archive Batch",
      message: `Archive Batch ${String(
        batch.batchNumber
      ).padStart(
        3,
        "0"
      )}? It will no longer be sold or visible to buyers, but you can unarchive it later.`,
      confirmLabel: "Archive",
      destructive: true,
      onConfirm: async () => {
        try {
          await archiveBatch(batch.docId);

          await fetchProducts();
        } catch (err) {
          showToast(
            getUserFriendlyErrorMessage(
              err,
              "Archive farmer product batch",
              "We couldn't update this batch right now. Please try again."
            )
          );
        }
      },
    });
  };

  const handleUnarchiveBatch = (batch: BatchType) => {
    setConfirmation({
      title: "Unarchive Batch",
      message: `Return Batch ${String(
        batch.batchNumber
      ).padStart(3, "0")} to active sales?`,
      confirmLabel: "Unarchive",
      onConfirm: async () => {
        try {
          await unarchiveBatch(batch.docId);

          await fetchProducts();
        } catch (err) {
          showToast(
            getUserFriendlyErrorMessage(
              err,
              "Unarchive farmer product batch",
              "We couldn't update this batch right now. Please try again."
            )
          );
        }
      },
    });
  };

  const toggleBatchHarvests = (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }

    setExpandedBatchId(batchId);

    loadHarvestsForBatch(batchId);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f5f5]">
        <ActivityIndicator color="#14532d" size="large" />
      </View>
    );
  }

  const listedProducts =
    viewMode === "active" ? products : archivedProducts;
  const filterByStock = (product: ProductType) => {
    const stock = getTotalStock(product.docId);
    const outOfStock = product.status === "Out of Stock" || stock <= 0;
    if (listFilter === "low_stock") return !outOfStock && stock <= 5;
    if (listFilter === "out_of_stock") return outOfStock;
    return true;
  };
  const displayedProducts = (detailProductId
    ? listedProducts.filter((product) => product.docId === detailProductId)
    : listedProducts.filter(filterByStock).filter((product) =>
        product.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ));
  const selectedFilterLabel = {
    active: "Active",
    archived: "Archived",
    low_stock: "Low stock",
    out_of_stock: "Out of stock",
  }[listFilter];

  return (
    <View className="flex-1 bg-[#f5f5f5]">
      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">
        {detailProductId && (
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 h-10 w-10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back to products"
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
        )}
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">
            {detailProductId
              ? displayedProducts[0]?.name || "Product batches"
              : "Product list"}
          </Text>
        </View>
        {!detailProductId && (
          <TouchableOpacity
            onPress={() => setShowProductsTutorial(true)}
            className="ml-3 h-10 w-10 items-center justify-center"
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open product listing tutorial"
          >
            <Ionicons name="play-circle-outline" size={25} color="white" />
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-1 px-4 pt-4">
        {!detailProductId && user?.role === "farmer" && (
          <View className="mb-3 flex-row items-center">
            <View className="mr-2 flex-1 flex-row items-center rounded-[10px] border border-gray-200 bg-white px-3">
              <Ionicons name="search-outline" size={19} color="#9ca3af" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search products"
                placeholderTextColor="#9ca3af"
                className="ml-2 flex-1 py-3 text-gray-800"
                returnKeyType="search"
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              ref={sortButtonRef}
              onPress={() => (showFilterModal ? setShowFilterModal(false) : openSortDropdown())}
              className="flex-row items-center rounded-[10px] border border-gray-200 bg-white px-3 py-3"
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${selectedFilterLabel}`}
            >
              <MaterialIcons name="sort" size={19} color="#14532d" />
              <Text className="ml-1.5 text-xs font-semibold text-gray-700">
                Sort by: {selectedFilterLabel}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: detailProductId
              ? getFarmerScreenBottomPadding(insets.bottom)
              : getFarmerTabBarClearance(insets.bottom) + 72,
          }}
        >
          {displayedProducts.length === 0 && (
            <Text className="mt-10 text-center text-gray-500">
              {detailProductId
                ? "This product could not be found."
                : searchQuery.trim()
                ? "No products match your search."
                : listFilter === "low_stock"
                ? "No low-stock products."
                : listFilter === "out_of_stock"
                ? "No out-of-stock products."
                : listFilter === "archived"
                ? "No archived products."
                : "No products available"}
            </Text>
          )}

          {displayedProducts.map((product) => {
            const activeBatches = getActiveBatches(
              product.docId
            );

            const archivedBatches = getArchivedBatches(
              product.docId
            );

            const currentBatch =
              getCurrentSellingBatch(product.docId);

            const totalStock = getTotalStock(
              product.docId
            );

            const isExpanded = detailProductId === product.docId;

            return (
              <View
                key={product.docId}
                className={`mb-3 rounded-[10px] bg-white p-3 ${
                  viewMode === "archived"
                    ? "opacity-70"
                    : ""
                }`}
              >
                {!detailProductId ? (
                  <>
                    <View className="flex-row items-center">
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: "/farmer/products/[id]",
                            params: {
                              id: product.docId,
                              mode: viewMode,
                            },
                          })
                        }
                        className="flex-1 flex-row items-center"
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`View batches for ${product.name}`}
                      >
                        {product.image ? (
                          <Image
                            source={{ uri: product.image }}
                            className="h-[72px] w-[72px] rounded-[10px]"
                          />
                        ) : (
                          <View className="h-[72px] w-[72px] items-center justify-center rounded-[10px] bg-gray-100">
                            <Ionicons
                              name="leaf-outline"
                              size={24}
                              color="#9ca3af"
                            />
                          </View>

                        )}
                        <View className="ml-3 flex-1">
                          <Text
                            className="text-base font-bold text-gray-900"
                            numberOfLines={1}
                          >
                            {product.name}
                          </Text>
                          <Text className="mt-1 text-sm text-gray-500">
                            {totalStock} {product.unit} in stock
                          </Text>
                          <Text className="mt-1 text-sm font-semibold text-gray-800">
                            ₱{Number(product.price || 0).toFixed(2)} /{" "}
                            {product.unit.replace(/^per /, "")}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#9ca3af"
                        />
                      </TouchableOpacity>
                    </View>

                    {user?.role === "farmer" && (
                      <View className="mt-3 flex-row border-t border-gray-100 pt-2">
                        {viewMode === "active" ? (
                          <>
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedProduct(product);
                                setShowRecordSaleModal(true);
                              }}
                              className="flex-1 flex-row items-center justify-center py-2"
                              accessibilityRole="button"
                              accessibilityLabel={`Record sale for ${product.name}`}
                            >
                              <Ionicons
                                name="storefront-outline"
                                size={17}
                                color="#14532d"
                              />
                              <View className="ml-1.5 items-center">
                                <Text className="text-[11px] font-semibold text-gray-700">
                                  Record sale
                                </Text>
                                <Text className="text-[9px] text-gray-500">(Itala ang Benta)</Text>
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedProduct(product);
                                setShowEditModal(true);
                              }}
                              className="flex-1 flex-row items-center justify-center py-2"
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${product.name}`}
                            >
                              <MaterialIcons
                                name="edit"
                                size={17}
                                color="#14532d"
                              />
                              <View className="ml-1.5 items-center">
                                <Text className="text-[11px] font-semibold text-gray-700">
                                  Edit
                                </Text>
                                <Text className="text-[9px] text-gray-500">(I-edit)</Text>
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedProduct(product);
                                setShowDeleteModal(true);
                              }}
                              className="flex-1 flex-row items-center justify-center py-2"
                              accessibilityRole="button"
                              accessibilityLabel={`Archive ${product.name}`}
                            >
                              <MaterialIcons
                                name="archive"
                                size={17}
                                color="#b45309"
                              />
                              <View className="ml-1.5 items-center">
                                <Text className="text-[11px] font-semibold text-gray-700">
                                  Archive
                                </Text>
                                <Text className="text-[9px] text-gray-500">(I-archive)</Text>
                              </View>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleUnarchiveProduct(product)}
                            className="flex-row items-center py-2"
                            accessibilityRole="button"
                          >
                            <Ionicons
                              name="refresh-outline"
                              size={17}
                              color="#14532d"
                            />
                            <View className="ml-1.5 items-start">
                              <Text className="text-[11px] font-semibold text-gray-700">
                                Restore product
                              </Text>
                              <Text className="text-[9px] text-gray-500">(Ibalik ang Produkto)</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  <View className="flex-row items-center">
                    {product.image ? (
                      <Image
                        source={{ uri: product.image }}
                        className="h-20 w-20 rounded-[10px]"
                      />
                    ) : (
                      <View className="h-20 w-20 rounded-[10px] bg-gray-100" />
                    )}
                    <View className="ml-4 flex-1">
                      <Text className="text-xs text-gray-500">
                        {product.farmName}
                      </Text>
                      <Text className="mt-1 text-sm text-gray-600">
                        {totalStock} {product.unit} available ·{" "}
                        {activeBatches.length} active{" "}
                        {activeBatches.length === 1 ? "batch" : "batches"}
                      </Text>
                      <Text className="mt-1 font-bold text-gray-900">
                        ₱{Number(product.price || 0).toFixed(2)} /{" "}
                        {product.unit.replace(/^per /, "")}
                      </Text>
                    </View>
                    {user?.role === "farmer" && viewMode === "active" && (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedProduct(product);
                          setShowEditModal(true);
                        }}
                        className="h-10 w-10 items-center justify-center rounded-[10px] bg-gray-50"
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${product.name}`}
                      >
                        <MaterialIcons name="edit" size={18} color="#14532d" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {isExpanded && (
                  <View className="mt-2">
                    <Text className="mb-3 mt-2 text-base font-bold text-gray-900">
                      Batches
                    </Text>
                    {activeBatches.length === 0 &&
                      archivedBatches.length === 0 && (
                        <Text className="text-gray-400 text-xs text-center py-2">
                          No batches yet
                        </Text>
                      )}


                    {activeBatches.map((batch) => {
                      const isCurrent =
                        currentBatch?.docId ===
                        batch.docId;

                      const harvests =
                        harvestsByBatch[
                          batch.docId
                        ] || [];

                      const harvestsExpanded =
                        expandedBatchId ===
                        batch.docId;

                      return (
                        <View
                          key={batch.docId}
                          className="mb-2 rounded-[10px] bg-gray-50 p-3"
                        >
                          <View className="flex-row items-center justify-between">
                            <View className="flex-1">

                              <View className="flex-row items-center flex-wrap">
                                <Text className="text-sm font-bold text-gray-800">
                                  Batch{" "}
                                  {String(
                                    batch.batchNumber
                                  ).padStart(
                                    3,
                                    "0"
                                  )}
                                </Text>

                                {isCurrent && (
                                  <View className="ml-2 rounded-full bg-green-50 px-2 py-0.5">
                                    <Text className="text-[11px] font-semibold text-[#14532d]">
                                      Selling now
                                    </Text>
                                  </View>
                                )}
                              </View>


                              <Text className="mt-1 text-sm text-gray-700">
                                Stock: {batch.stock} {product.unit}
                              </Text>
                              <Text className="mt-0.5 text-xs text-gray-500">
                                ₱{Number(product.price || 0).toFixed(2)} per{" "}
                                {product.unit.replace(/^per /, "")} · {batch.status}
                              </Text>


                              <Text className="mt-1 text-xs text-gray-500">
                                Total harvested:{" "}
                                {batch.totalHarvested}{" "}
                                {product.unit}
                              </Text>
                            </View>


                            {user?.role ===
                              "farmer" && (
                              <View className="flex-row">

                                <TouchableOpacity
                                  className="mr-2 flex-row items-center rounded-[10px] bg-white px-3 py-2"
                                  accessibilityRole="button"
                                  accessibilityLabel={`Edit batch ${batch.batchNumber}`}
                                  onPress={() => {
                                    setSelectedBatch(
                                      batch
                                    );
                                    setSelectedBatchUnit(product.unit);

                                    setShowEditBatchModal(
                                      true
                                    );
                                  }}
                                >
                                  <MaterialIcons
                                    name="edit"
                                    size={17}
                                    color="#14532d"
                                  />
                                  <Text className="ml-1 text-xs font-semibold text-gray-700">
                                    Edit
                                  </Text>
                                </TouchableOpacity>


                                <TouchableOpacity
                                  className="flex-row items-center rounded-[10px] bg-white px-3 py-2"
                                  accessibilityRole="button"
                                  accessibilityLabel={`Archive batch ${batch.batchNumber}`}
                                  onPress={() =>
                                    handleArchiveBatchPress(
                                      batch
                                    )
                                  }
                                >
                                  <MaterialIcons
                                    name="archive"
                                    size={17}
                                    color="#b45309"
                                  />
                                  <Text className="ml-1 text-xs font-semibold text-gray-700">
                                    Archive
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>


                          <TouchableOpacity
                            onPress={() =>
                              toggleBatchHarvests(
                                batch.docId
                              )
                            }
                            className="mt-3 flex-row items-center py-1"
                            accessibilityRole="button"
                          >
                            <Text className="mr-1 text-xs font-semibold text-gray-700">
                              {harvestsExpanded
                                ? "Hide harvests"
                                : "View harvests"}
                            </Text>

                            <Ionicons
                              name={
                                harvestsExpanded
                                  ? "chevron-up"
                                  : "chevron-down"
                              }
                              size={16}
                              color="#14532d"
                            />
                          </TouchableOpacity>


                          {harvestsExpanded && (
                            <View className="mt-2 pl-2 border-l-2 border-gray-200">
                              <Text className="mb-1 text-[10px] text-gray-400">
                                Harvest records are saved for your sales history and cannot be deleted.
                              </Text>
                              {harvests.length ===
                                0 && (
                                <Text className="py-1 text-xs text-gray-500">
                                  No harvest records yet
                                </Text>
                              )}

                              {harvests.map((h) => {
                                // Newer records carry a type of either "harvest" or "restock".
                                const recordType = (
                                  h as HarvestRecordType & {
                                    type?: string;
                                  }
                                ).type;

                                return (
                                  <View
                                    key={h.docId}
                                    className="flex-row items-center justify-between py-2"
                                  >
                                  <Text className="flex-1 text-xs text-gray-600">
                                      {recordType ===
                                      "restock"
                                        ? `${formatDate(
                                            h.harvestDate
                                          )} · Restock (${h.quantity} product/ ${product.unit})`
                                        : `${formatDate(
                                            h.harvestDate
                                          )} · ${h.quantity} added/${product.unit} (${h.remainingQuantity} last stock)`}
                                    </Text>

                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}


                    {archivedBatches.length > 0 && (
                      <View className="mt-1">
                        <Text className="mb-2 text-sm font-semibold text-gray-700">
                          Archived Batches
                        </Text>

                        {viewMode ===
                          "archived" && (
                          <Text className="mb-2 text-sm text-gray-500">
                            This entire product is archived, so its batches are also
                            locked. Unarchive the product first before unarchiving any batch.
                          </Text>
                        )}

                        {archivedBatches.map(
                          (batch) => (
                            <View
                              key={batch.docId}
                              className="mb-2 rounded-[10px] bg-gray-50 p-3"
                            >
                              <View className="flex-row items-center justify-between">
                                <View className="flex-1">
                                  <Text className="text-sm font-semibold text-gray-700">
                                    Batch{" "}
                                    {String(
                                      batch.batchNumber
                                    ).padStart(
                                      3,
                                      "0"
                                    )}{" "}
                                    (archived)
                                  </Text>

                                  <Text className="mt-1 text-xs text-gray-500">
                                    {batch.stock}{" "}
                                    {product.unit}{" "}
                                    · {batch.status}
                                  </Text>
                                </View>


                                {user?.role ===
                                  "farmer" &&
                                  viewMode ===
                                    "active" && (
                                    <TouchableOpacity
                                      className="flex-row items-center rounded-[10px] bg-green-50 px-3 py-2"
                                      onPress={() =>
                                        handleUnarchiveBatch(
                                          batch
                                        )
                                      }
                                      accessibilityRole="button"
                                    >
                                      <Text className="text-xs font-semibold text-[#14532d]">
                                        Unarchive
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                              </View>
                            </View>
                          )
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {!detailProductId && user?.role === "farmer" && viewMode === "active" && (
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          className="absolute right-5 h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: "#14532d",
            bottom: getFarmerTabBarClearance(insets.bottom),
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.24,
            shadowRadius: 5,
          }}
          accessibilityRole="button"
          accessibilityLabel="Add product"
        >
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      )}

      {/* The sort menu uses the same anchored design and options as the farm profile
          sort. */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1 }}
          onPress={() => setShowFilterModal(false)}
        >
          <View
            className="absolute bg-white rounded-[14px] py-1.5"
            style={{
              top: dropdownPos.top,
              right: dropdownPos.right,
              width: 180,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 10,
              elevation: 8,
            }}
          >
            {FILTER_OPTIONS.map((opt) => {
              const active = listFilter === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    setListFilter(opt.value);
                    setViewMode(opt.value === "archived" ? "archived" : "active");
                    setShowFilterModal(false);
                  }}
                  className={`flex-row items-center justify-between px-3.5 py-2.5 ${
                    active ? "bg-green-50" : ""
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={active ? "#14532d" : "#6b7280"}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        active ? "text-green-900" : "text-gray-700"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={16} color="#14532d" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>


      <AddProductModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddProduct}
        loading={uploading}
        farmerId={user?.uid}
        farmerName={user?.fullName}
        farmName={user?.farmName}
      />

      {selectedProduct && (
        <EditProductModal
          visible={showEditModal}
          product={selectedProduct}
          onClose={() => setShowEditModal(false)}
          onSave={handleEditProduct}
          loading={editing}
        />
      )}

      <EditBatchModal
        visible={showEditBatchModal}
        batch={selectedBatch}
        unit={selectedBatchUnit}
        onClose={() => setShowEditBatchModal(false)}
        onSave={handleSaveBatch}
        loading={savingBatch}
      />

      <DeleteProductModal
        visible={showDeleteModal}
        product={selectedProduct}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteProduct}
        loading={deleting}
      />

      <RecordSaleModal
        visible={showRecordSaleModal}
        product={selectedProduct}
        onClose={() => setShowRecordSaleModal(false)}
        onConfirm={handleRecordSale}
        loading={recordingSale}
      />

      <Modal
        visible={confirmation !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setConfirmation(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-[340px] rounded-[10px] bg-white p-6">
            <Text className="mb-2 text-lg font-semibold text-gray-800">
              {confirmation?.title}
            </Text>
            <Text className="text-sm leading-5 text-gray-600">
              {confirmation?.message}
            </Text>
            <View className="mt-6 flex-row justify-between">
              <TouchableOpacity
                className="mr-2 flex-1 items-center rounded-[10px] bg-gray-200 px-4 py-3"
                onPress={() => setConfirmation(null)}
              >
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="ml-2 flex-1 items-center rounded-[10px] px-4 py-3"
                style={{
                  backgroundColor: confirmation?.destructive
                    ? "#dc2626"
                    : "#14532d",
                }}
                onPress={() => {
                  const action = confirmation?.onConfirm;
                  setConfirmation(null);
                  if (action) void action();
                }}
              >
                <Text className="font-semibold text-white">
                  {confirmation?.confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <FarmerTutorialVideoModal
        tutorial="products"
        title="Product listing tutorial"
        visible={showProductsTutorial}
        onClose={() => setShowProductsTutorial(false)}
      />
    </View>
  );
};

export default function Product() {
  return <ProductScreen />;
}