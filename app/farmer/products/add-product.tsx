import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type {
  CreateProductInput,
  ProductCategory,
  ProductVariation,
} from "../../../src/types/product";
import {
  CATEGORIES,
  PRODUCT_CATALOG,
  getUnitsForProduct,
} from "@/src/constants/productCatalog";
import {
  getProductVideoValidationError,
  MAX_PRODUCT_IMAGES,
} from "@/src/constants/productMedia";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (input: CreateProductInput) => Promise<void>;
  loading: boolean;
  farmerId: string;
  farmerName: string;
  farmName: string;
};

type VariationDraft = {
  id: string;
  name: string;
  price: string;
  stock: string;
  unit: string;
  description: string;
};

const createDraft = (unit = ""): VariationDraft => ({
  id: `variation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  price: "",
  stock: "",
  unit,
  description: "",
});

export default function AddProductModal({
  visible,
  onClose,
  onSave,
  loading,
  farmerId,
  farmerName,
  farmName,
}: Props) {
  const [category, setCategory] = useState<ProductCategory>("Vegetables");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [freshness, setFreshness] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState("");
  const [variations, setVariations] = useState<VariationDraft[]>([
    createDraft("per kg"),
  ]);
  const [error, setError] = useState("");

  const productNames = PRODUCT_CATALOG[category] || [];
  const units = getUnitsForProduct(category, name);

  useEffect(() => {
    if (visible) return;
    setCategory("Vegetables");
    setName("");
    setDescription("");
    setFreshness("");
    setImages([]);
    setVideo("");
    setVariations([createDraft("per kg")]);
    setError("");
  }, [visible]);

  useEffect(() => {
    const defaultUnit = getUnitsForProduct(category, name)[0] || "unit";
    setVariations((current) =>
      current.map((variation) => ({
        ...variation,
        unit: variation.unit || defaultUnit,
      }))
    );
  }, [category, name]);

  const updateVariation = (
    id: string,
    field: keyof VariationDraft,
    value: string
  ) => {
    setVariations((current) =>
      current.map((variation) =>
        variation.id === id ? { ...variation, [field]: value } : variation
      )
    );
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PRODUCT_IMAGES - images.length,
    });
    if (!result.canceled) {
      setImages((current) =>
        [...current, ...result.assets.map((asset) => asset.uri)].slice(
          0,
          MAX_PRODUCT_IMAGES
        )
      );
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 20,
      quality: 0.5,
    });
    if (result.canceled || !result.assets[0]) return;
    const validationError = getProductVideoValidationError(result.assets[0]);
    if (validationError) {
      setError(validationError);
      return;
    }
    setVideo(result.assets[0].uri);
    setError("");
  };

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || (!images.length && !video)) {
      setError("Enter product details and add at least one product image or video.");
      return;
    }
    if (
      variations.length === 0 ||
      variations.some(
        (variation) =>
          !variation.name.trim() ||
          !variation.unit.trim() ||
          !variation.price.trim() ||
          !variation.stock.trim() ||
          !Number.isFinite(Number(variation.price)) ||
          Number(variation.price) < 0 ||
          !Number.isFinite(Number(variation.stock)) ||
          Number(variation.stock) < 0
      )
    ) {
      setError("Every variation needs a name, valid price, unit, and stock.");
      return;
    }

    const normalizedVariations: ProductVariation[] = variations.map(
      (variation) => {
        const stock = Number(variation.stock);
        return {
          ...variation,
          price: Number(variation.price),
          stock,
          status: stock > 0 ? "Available" : "Out of Stock",
        };
      }
    );
    const first = normalizedVariations[0];
    const input: CreateProductInput = {
      name: name.trim(),
      category,
      unit: first.unit,
      description: description.trim(),
      freshness: freshness.trim(),
      image: images[0] || "",
      imagePublicId: "",
      images,
      imagePublicIds: [],
      video,
      videoPublicId: "",
      farmerId,
      farmerName,
      farmName,
      rating: 0,
      totalReviews: 0,
      totalSales: 0,
      weeklySales: 0,
      monthlySales: 0,
      createdAt: Date.now(),
      price: Math.min(...normalizedVariations.map((item) => item.price)),
      stock: normalizedVariations.reduce((sum, item) => sum + item.stock, 0),
      status: normalizedVariations.some((item) => item.stock > 0)
        ? "Available"
        : "Out of Stock",
      variations: normalizedVariations,
      archived: false,
    };

    try {
      setError("");
      await onSave(input);
      onClose();
    } catch (saveError) {
      setError(
        getUserFriendlyErrorMessage(
          saveError,
          "Create farmer product",
          "We couldn't create this listing. Please try again."
        )
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center bg-black/40 px-5">
        <View className="max-h-[92%] rounded-xl bg-white p-5">
          <Text className="mb-1 text-lg font-bold text-gray-900">
            Add product listing
          </Text>
          <Text className="mb-4 text-sm text-gray-500">
            Create one listing, then set the price and stock for each variation.
          </Text>
          {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-2 text-xs font-semibold text-gray-500">CATEGORY</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {CATEGORIES.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => {
                    setCategory(item as ProductCategory);
                    setName("");
                  }}
                  className={`rounded-full px-3 py-2 ${
                    category === item ? "bg-green-900" : "bg-gray-100"
                  }`}
                >
                  <Text className={category === item ? "text-white" : "text-gray-700"}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="mb-2 text-xs font-semibold text-gray-500">PRODUCT</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {productNames.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setName(item)}
                  className={`rounded-lg border px-3 py-2 ${
                    name === item ? "border-green-900 bg-green-50" : "border-gray-200"
                  }`}
                >
                  <Text className="text-sm text-gray-800">{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Product description"
              className="mb-3 min-h-20 rounded-lg border border-gray-300 px-3 py-2"
            />
            <TextInput
              value={freshness}
              onChangeText={setFreshness}
              placeholder="Freshness information (optional)"
              className="mb-4 rounded-lg border border-gray-300 px-3 py-2"
            />

            <Text className="mb-2 text-xs font-semibold text-gray-500">
              PRODUCT VARIATIONS
            </Text>
            {variations.map((variation, index) => (
              <View key={variation.id} className="mb-3 rounded-lg bg-gray-50 p-3">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="font-semibold text-gray-800">
                    Variation {index + 1}
                  </Text>
                  {variations.length > 1 && (
                    <TouchableOpacity
                      onPress={() =>
                        setVariations((current) =>
                          current.filter((entry) => entry.id !== variation.id)
                        )
                      }
                    >
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  value={variation.name}
                  onChangeText={(value) => updateVariation(variation.id, "name", value)}
                  placeholder="Name (e.g. Small)"
                  className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2"
                />
                <View className="flex-row gap-2">
                  <TextInput
                    value={variation.price}
                    onChangeText={(value) => updateVariation(variation.id, "price", value)}
                    keyboardType="decimal-pad"
                    placeholder="Price (₱)"
                    className="mb-2 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2"
                  />
                  <TextInput
                    value={variation.stock}
                    onChangeText={(value) => updateVariation(variation.id, "stock", value)}
                    keyboardType="decimal-pad"
                    placeholder="Stock"
                    className="mb-2 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2"
                  />
                </View>
                <TextInput
                  value={variation.unit}
                  onChangeText={(value) => updateVariation(variation.id, "unit", value)}
                  placeholder={`Unit (${units[0] || "per piece"})`}
                  className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2"
                />
                <TextInput
                  value={variation.description}
                  onChangeText={(value) =>
                    updateVariation(variation.id, "description", value)
                  }
                  placeholder="Optional variation description"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2"
                />
              </View>
            ))}
            <TouchableOpacity
              onPress={() =>
                setVariations((current) => [...current, createDraft(units[0] || "unit")])
              }
              className="mb-4 flex-row items-center justify-center rounded-lg border border-green-900 py-3"
            >
              <Ionicons name="add" size={18} color="#14532d" />
              <Text className="ml-1 font-semibold text-green-900">Add another variation</Text>
            </TouchableOpacity>

            <View className="mb-4 flex-row gap-2">
              <TouchableOpacity
                onPress={pickImages}
                disabled={images.length >= MAX_PRODUCT_IMAGES}
                className="flex-1 items-center rounded-lg border border-green-900 py-3"
              >
                <Text className="text-xs font-semibold text-green-900">
                  Add images ({images.length}/{MAX_PRODUCT_IMAGES})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickVideo}
                disabled={!!video}
                className="flex-1 items-center rounded-lg border border-green-900 py-3"
              >
                <Text className="text-xs font-semibold text-green-900">Add video</Text>
              </TouchableOpacity>
            </View>
            {images.length > 0 && (
              <View className="mb-3 flex-row flex-wrap gap-2">
                {images.map((uri, index) => (
                  <TouchableOpacity
                    key={`${uri}-${index}`}
                    onPress={() =>
                      setImages((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index)
                      )
                    }
                  >
                    <Image source={{ uri }} className="h-14 w-14 rounded-lg" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {video ? (
              <TouchableOpacity
                onPress={() => setVideo("")}
                className="mb-3 flex-row items-center"
              >
                <Ionicons name="videocam" size={18} color="#14532d" />
                <Text className="ml-2 text-sm text-gray-700">Video selected (tap to remove)</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity onPress={onClose} className="flex-1 items-center rounded-lg border border-green-900 py-3">
              <Text className="font-semibold text-green-900">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              className="flex-1 items-center rounded-lg bg-green-900 py-3"
            >
              {loading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Create listing</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
