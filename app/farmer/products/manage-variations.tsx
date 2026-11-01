import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { ProductType, ProductVariation } from "../../../src/types/product";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

type Props = {
  visible: boolean;
  onClose: () => void;
  product: ProductType | null;
  onSave: (variations: ProductVariation[]) => Promise<void>;
  loading: boolean;
};

type VariationDraft = Omit<ProductVariation, "price" | "stock"> & {
  price: string;
  stock: string;
};

const newVariation = (): VariationDraft => ({
  id: `variation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  price: "",
  stock: "",
  unit: "",
  description: "",
  status: "Out of Stock",
});

export default function ManageVariationsModal({
  visible,
  onClose,
  product,
  onSave,
  loading,
}: Props) {
  const [variations, setVariations] = useState<VariationDraft[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (product) {
      setVariations(
        product.variations.map((variation) => ({
          ...variation,
          price: String(variation.price),
          stock: String(variation.stock),
        }))
      );
      setError("");
    }
  }, [product]);

  const updateVariation = (
    id: string,
    field: keyof ProductVariation,
    value: string
  ) => {
    setVariations((current) =>
      current.map((variation) =>
        variation.id === id
          ? {
              ...variation,
              [field]: value,
            }
          : variation
      )
    );
  };

  const handleSave = async () => {
    const invalid = variations.some(
      (variation) =>
        !variation.name.trim() ||
        !variation.unit.trim() ||
        !String(variation.price).trim() ||
        !String(variation.stock).trim() ||
        !Number.isFinite(Number(variation.price)) ||
        Number(variation.price) < 0 ||
        !Number.isFinite(Number(variation.stock)) ||
        Number(variation.stock) < 0
    );
    if (variations.length === 0 || invalid) {
      setError("Each variation needs a name, valid price, unit, and stock.");
      return;
    }

    try {
      setError("");
      await onSave(
        variations.map((variation) => {
          const stock = Number(variation.stock);
          return {
            ...variation,
            price: Number(variation.price),
            stock,
            status: stock > 0 ? "Available" : "Out of Stock",
          };
        })
      );
      onClose();
    } catch (saveError) {
      setError(
        getUserFriendlyErrorMessage(
          saveError,
          "Save product variations",
          "We couldn't save these variations. Please try again."
        )
      );
    }
  };

  if (!product) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center bg-black/40 px-5">
        <View className="max-h-[90%] rounded-xl bg-white p-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="flex-1 text-lg font-bold text-gray-900">
              {product.name} variations
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <Text className="mb-4 text-sm text-gray-500">
            Set each size or unit&apos;s own price and stock. A variation with
            zero stock is unavailable to buyers.
          </Text>

          {error ? (
            <Text className="mb-3 text-sm text-red-600">{error}</Text>
          ) : null}

          <ScrollView keyboardShouldPersistTaps="handled">
            {variations.map((variation, index) => (
              <View
                key={variation.id}
                className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
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
                      accessibilityLabel={`Remove ${variation.name || "variation"}`}
                    >
                      <Ionicons name="trash-outline" size={19} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  value={variation.name}
                  onChangeText={(value) =>
                    updateVariation(variation.id, "name", value)
                  }
                  placeholder="Name (e.g. Small)"
                  className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2"
                />
                <View className="flex-row gap-2">
                  <TextInput
                    value={String(variation.price)}
                    onChangeText={(value) =>
                      updateVariation(variation.id, "price", value)
                    }
                    keyboardType="decimal-pad"
                    placeholder="Price (₱)"
                    className="mb-2 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2"
                  />
                  <TextInput
                    value={String(variation.stock)}
                    onChangeText={(value) =>
                      updateVariation(variation.id, "stock", value)
                    }
                    keyboardType="decimal-pad"
                    placeholder="Stock"
                    className="mb-2 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2"
                  />
                </View>
                <TextInput
                  value={variation.unit}
                  onChangeText={(value) =>
                    updateVariation(variation.id, "unit", value)
                  }
                  placeholder="Unit (e.g. per piece, per kg)"
                  className="mb-2 rounded-lg border border-gray-300 bg-white px-3 py-2"
                />
                <TextInput
                  value={variation.description || ""}
                  onChangeText={(value) =>
                    updateVariation(variation.id, "description", value)
                  }
                  placeholder="Optional description"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2"
                />
                <Text className="mt-2 text-xs text-gray-500">
                  Available stock: {variation.stock || 0}{" "}
                  {variation.unit || ""}
                </Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={() => setVariations((current) => [...current, newVariation()])}
            className="mb-3 flex-row items-center justify-center rounded-lg border border-green-800 py-3"
          >
            <Ionicons name="add" size={18} color="#14532d" />
            <Text className="ml-1 font-semibold text-green-900">
              Add variation
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            className="items-center rounded-lg bg-green-900 py-3"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-bold text-white">Save variations</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
