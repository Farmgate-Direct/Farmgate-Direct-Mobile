import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AddProductModal from "../../farmer/products/add-product";
import DeleteProductModal from "../../farmer/products/delete-product";
import EditProductModal from "../../farmer/products/edit-product";
import ManageVariationsModal from "../../farmer/products/manage-variations";
import RecordSaleModal from "../../farmer/products/record-sale";
import {
  createProduct,
  getArchivedProducts,
  getFarmerProducts,
  updateProductInfo,
  updateProductVariations,
  archiveProduct,
  unarchiveProduct,
} from "../../../src/services/productService";
import { deleteCartItemsByProductId } from "../../../src/services/cartService";
import { recordWalkInSale } from "../../../src/services/orderService";
import type {
  CreateProductInput,
  ProductType,
  ProductVariation,
} from "../../../src/types/product";
import {
  uploadImageAsync,
  uploadProductVideoAsync,
} from "../../../src/services/cloudinaryService";
import { deleteCloudinaryImage } from "../../../src/services/deleteImageService";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";
import { useToast } from "@/src/context/ToastContext";
import {
  MAX_PRODUCT_IMAGES,
} from "@/src/constants/productMedia";
import {
  getFarmerScreenBottomPadding,
  getFarmerTabBarClearance,
} from "@/src/constants/farmerLayout";

type ViewMode = "active" | "archived";
type Props = { detailProductId?: string; initialViewMode?: ViewMode };

const getVideoThumbnailUrl = (videoUrl: string) =>
  videoUrl.replace("/video/upload/", "/video/upload/so_0/").replace(/\.[^/.]+$/, ".jpg");

const uploadProductMedia = async (product: ProductType | CreateProductInput) => {
  const imageUris =
    product.images?.length
      ? product.images
      : !product.video && product.image
        ? [product.image]
        : [];
  const uploadedImages = await Promise.all(
    imageUris.map(async (uri, index) => {
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
    const uploaded = await uploadProductVideoAsync(video);
    video = uploaded.videoUrl;
    videoPublicId = uploaded.publicId;
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

export const ProductScreen = ({
  detailProductId,
  initialViewMode = "active",
}: Props = {}) => {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [user, setUser] = useState<any>(null);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<ProductType[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [filterMode, setFilterMode] = useState<"all" | "low" | "out">(
    filter === "low_stock" ? "low" : filter === "out_of_stock" ? "out" : "all"
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showVariations, setShowVariations] = useState(false);
  const [showRecordSale, setShowRecordSale] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("user").then((value) => {
      if (value) setUser(JSON.parse(value));
    });
  }, []);

  const loadProducts = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const [active, archived] = await Promise.all([
        getFarmerProducts(user.uid),
        getArchivedProducts(user.uid),
      ]);
      setProducts(active);
      setArchivedProducts(archived);
    } catch (error) {
      showToast(getUserFriendlyErrorMessage(error, "Load farmer products"));
    } finally {
      setLoading(false);
    }
  }, [showToast, user]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const saveNewProduct = async (input: CreateProductInput) => {
    setSaving(true);
    try {
      const media = await uploadProductMedia(input);
      await createProduct({
        ...input,
        ...media,
        farmerId: user.uid,
        farmerName: user.fullName || "",
        farmName: user.farmName || "",
      });
      await loadProducts();
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  };

  const saveProductInfo = async (product: ProductType) => {
    setSaving(true);
    try {
      const media = await uploadProductMedia(product);
      await updateProductInfo({ ...product, ...media });
      const oldPublicIds = product.imagePublicIds?.length
        ? product.imagePublicIds
        : product.imagePublicId
          ? [product.imagePublicId]
          : [];
      const retained = new Set(media.imagePublicIds);
      await Promise.all(
        oldPublicIds
          .filter((id) => id && !retained.has(id))
          .map(deleteCloudinaryImage)
      );
      await loadProducts();
      setShowEdit(false);
    } finally {
      setSaving(false);
    }
  };

  const saveVariations = async (variations: ProductVariation[]) => {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      await updateProductVariations(selectedProduct.docId, variations);
      await loadProducts();
      setShowVariations(false);
    } finally {
      setSaving(false);
    }
  };

  const archiveSelectedProduct = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      await archiveProduct(selectedProduct.docId);
      await deleteCartItemsByProductId(selectedProduct.docId);
      await loadProducts();
      setShowArchive(false);
    } catch (error) {
      showToast(
        getUserFriendlyErrorMessage(error, "Archive farmer product")
      );
    } finally {
      setSaving(false);
    }
  };

  const visibleProducts = (
    viewMode === "active" ? products : archivedProducts
  )
    .filter((product) => {
      if (detailProductId && product.docId !== detailProductId) return false;
      if (!product.name.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      if (viewMode === "archived" || filterMode === "all") return true;
      if (filterMode === "low") {
        return product.variations.some(
          (variation) => variation.stock > 0 && variation.stock <= 5
        );
      }
      return product.variations.every((variation) => variation.stock <= 0);
    });

  const openVariations = (product: ProductType) => {
    setSelectedProduct(product);
    setShowVariations(true);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f5f5]">
        <ActivityIndicator size="large" color="#14532d" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f5f5f5]">
      <View className="flex-row items-center rounded-b-2xl bg-green-900 px-5 pb-4 pt-14">
        {detailProductId ? (
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
        ) : null}
        <Text className="flex-1 text-lg font-bold text-white">
          {detailProductId ? "Product details" : "Product list"}
        </Text>
      </View>

      <View className="flex-1 px-4 pt-4">
        {!detailProductId && (
          <>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search products"
              className="mb-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
            />
            <View className="mb-3 flex-row gap-2">
              {(["active", "archived"] as ViewMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setViewMode(mode)}
                  className={`rounded-full px-4 py-2 ${
                    viewMode === mode ? "bg-green-900" : "bg-white"
                  }`}
                >
                  <Text className={viewMode === mode ? "text-white" : "text-gray-700"}>
                    {mode === "active" ? "Active" : "Archived"}
                  </Text>
                </TouchableOpacity>
              ))}
              {viewMode === "active" &&
                (["all", "low", "out"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setFilterMode(mode)}
                    className={`rounded-full px-3 py-2 ${
                      filterMode === mode ? "bg-green-100" : "bg-white"
                    }`}
                  >
                    <Text className="text-xs text-green-900">
                      {mode === "all" ? "All" : mode === "low" ? "Low stock" : "Out"}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: detailProductId
              ? getFarmerScreenBottomPadding(insets.bottom)
              : getFarmerTabBarClearance(insets.bottom) + 72,
          }}
        >
          {visibleProducts.length === 0 ? (
            <Text className="mt-10 text-center text-gray-500">
              {detailProductId ? "Product not found." : "No products found."}
            </Text>
          ) : (
            visibleProducts.map((product) => (
              <View key={product.docId} className="mb-3 rounded-xl bg-white p-4">
                <View className="flex-row items-center">
                  {product.image ? (
                    <Image source={{ uri: product.image }} className="h-16 w-16 rounded-lg" />
                  ) : (
                    <View className="h-16 w-16 items-center justify-center rounded-lg bg-green-50">
                      <Ionicons name="leaf-outline" size={24} color="#14532d" />
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="font-bold text-gray-900">{product.name}</Text>
                    <Text className="mt-1 text-xs text-gray-500">
                      {product.variations.length} variation
                      {product.variations.length === 1 ? "" : "s"} ·{" "}
                      {product.variations.filter((item) => item.stock > 0).length} available
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-green-900">
                      {product.variations.length > 1 ? "From " : ""}
                      ₱{Math.min(...product.variations.map((item) => item.price)).toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openVariations(product)}>
                    <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {product.variations.map((variation) => (
                  <View
                    key={variation.id}
                    className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-2"
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-800">
                        {variation.name} · ₱{variation.price.toFixed(2)}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {variation.stock} {variation.unit} ·{" "}
                        {variation.stock > 0 ? "Available" : "Unavailable"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openVariations(product)}
                      accessibilityLabel={`Edit ${variation.name} variation`}
                    >
                      <Ionicons name="create-outline" size={19} color="#14532d" />
                    </TouchableOpacity>
                  </View>
                ))}

                {viewMode === "active" ? (
                  <View className="mt-3 flex-row justify-between border-t border-gray-100 pt-2">
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedProduct(product);
                        setShowRecordSale(true);
                      }}
                      className="items-center"
                    >
                      <Ionicons name="storefront-outline" size={19} color="#14532d" />
                      <Text className="text-xs text-gray-700">Record sale</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedProduct(product);
                        setShowEdit(true);
                      }}
                      className="items-center"
                    >
                      <Ionicons name="create-outline" size={19} color="#14532d" />
                      <Text className="text-xs text-gray-700">Edit product</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedProduct(product);
                        setShowArchive(true);
                      }}
                      className="items-center"
                    >
                      <Ionicons name="archive-outline" size={19} color="#b45309" />
                      <Text className="text-xs text-gray-700">Archive</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={async () => {
                      await unarchiveProduct(product.docId);
                      await loadProducts();
                    }}
                    className="mt-3 items-center border-t border-gray-100 pt-3"
                  >
                    <Text className="font-semibold text-green-900">Unarchive product</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {!detailProductId && viewMode === "active" && (
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          className="absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full bg-green-900"
          style={{ bottom: getFarmerTabBarClearance(insets.bottom) }}
        >
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      )}

      <AddProductModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={saveNewProduct}
        loading={saving}
        farmerId={user?.uid || ""}
        farmerName={user?.fullName || ""}
        farmName={user?.farmName || ""}
      />
      {selectedProduct && (
        <>
          <EditProductModal
            visible={showEdit}
            onClose={() => setShowEdit(false)}
            product={selectedProduct}
            onSave={saveProductInfo}
            loading={saving}
          />
          <ManageVariationsModal
            visible={showVariations}
            onClose={() => setShowVariations(false)}
            product={selectedProduct}
            onSave={saveVariations}
            loading={saving}
          />
          <RecordSaleModal
            visible={showRecordSale}
            onClose={() => setShowRecordSale(false)}
            product={selectedProduct}
            onConfirm={async (variationId, quantity) => {
              await recordWalkInSale(selectedProduct.docId, variationId, quantity);
              await loadProducts();
            }}
            loading={saving}
          />
          <DeleteProductModal
            visible={showArchive}
            onCancel={() => setShowArchive(false)}
            onConfirm={archiveSelectedProduct}
            loading={saving}
            product={selectedProduct}
          />
        </>
      )}
    </View>
  );
};

export default function FarmerProducts() {
  return <ProductScreen />;
}
