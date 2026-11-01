import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { ProductType } from "../../../src/types/product";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

type Props = {
  visible: boolean;
  onClose: () => void;
  product: ProductType | null;
  onConfirm: (variationId: string, quantity: number) => Promise<void>;
  loading: boolean;
};

export default function RecordSaleModal({
  visible,
  onClose,
  product,
  onConfirm,
  loading,
}: Props) {
  const [variationId, setVariationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const variation = product?.variations.find((item) => item.id === variationId);

  useEffect(() => {
    setVariationId(product?.variations[0]?.id || "");
    setQuantity("");
    setError("");
  }, [product, visible]);

  const submit = async () => {
    const amount = Number(quantity);
    if (!variation || !Number.isFinite(amount) || amount <= 0) {
      setError("Choose a variation and enter a valid quantity.");
      return;
    }
    if (amount > variation.stock) {
      setError(`Only ${variation.stock} ${variation.unit} is available.`);
      return;
    }
    try {
      setError("");
      await onConfirm(variation.id, amount);
      setQuantity("");
      onClose();
    } catch (submitError) {
      setError(
        getUserFriendlyErrorMessage(
          submitError,
          "Record farmer walk-in sale",
          "We couldn't record this sale. Please try again."
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
      <View className="flex-1 justify-center bg-black/40 px-6">
        <View className="rounded-xl bg-white p-5">
          <View className="mb-3 flex-row items-center">
            <Ionicons name="storefront-outline" size={22} color="#14532d" />
            <Text className="ml-2 flex-1 text-lg font-bold text-gray-900">
              Record walk-in sale
            </Text>
          </View>
          <Text className="mb-3 text-sm text-gray-500">{product.name}</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {product.variations.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setVariationId(item.id)}
                className={`rounded-lg border px-3 py-2 ${
                  variationId === item.id
                    ? "border-green-900 bg-green-50"
                    : "border-gray-200"
                }`}
              >
                <Text className="text-sm text-gray-800">{item.name}</Text>
                <Text className="text-xs text-gray-500">
                  {item.stock} {item.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={quantity}
            onChangeText={(value) => {
              if (/^\d*\.?\d*$/.test(value)) setQuantity(value);
            }}
            keyboardType="decimal-pad"
            placeholder={`Quantity (${variation?.unit || "unit"})`}
            className="mb-3 rounded-lg border border-gray-300 px-3 py-3"
          />
          {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 items-center rounded-lg border border-green-900 py-3"
            >
              <Text className="font-semibold text-green-900">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={loading}
              className="flex-1 items-center rounded-lg bg-green-900 py-3"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-bold text-white">Record sale</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
