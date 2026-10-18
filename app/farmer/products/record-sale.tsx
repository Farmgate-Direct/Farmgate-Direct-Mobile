// Farmer record walk-in sale modal.
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ProductType } from "../../../src/types/product";

type Props = {
  visible: boolean;
  onClose: () => void;
  product: ProductType | null;
  onConfirm: (quantity: number) => Promise<void>;
  loading: boolean;
};

// Confirmation popup for a sale made directly at the farm.
// This is for a walk in customer who does not use the app. Recording the sale
// here is what keeps the stock in the system correct, otherwise the amount in
// Firestore would drift away from what is really left in the field.
// It uses the same FIFO logic as recordSale in productService, which the online
// checkout also uses. Stock is therefore taken automatically from the oldest
// available batch, together with its harvest record, so the farmer never has to
// choose which batch to reduce.
const RecordSaleModal = ({ visible, onClose, product, onConfirm, loading }: Props) => {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");

  const handleQuantityChange = (text: string) => {
    if (/^\d*$/.test(text)) setQuantity(text);
  };

  const resetForm = () => {
    setQuantity("");
    setError("");
  };

// Checks the quantity and then records the sale.
  const handleConfirm = async () => {
    const qty = Number(quantity);

    if (!quantity || qty <= 0) {
      setError("Ilagay ang tamang quantity.");
      return;
    }

    if (product && qty > product.stock) {
      setError(
        `Lampas ito sa kasalukuyang available na stock (${product.stock} ${product.unit}).`
      );
      return;
    }

    setError("");
    await onConfirm(qty);
    resetForm();
  };

  if (!product) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        resetForm();
        onClose();
      }}
    >
      <View className="flex-1 justify-center bg-black/40 px-6">
        <View className="rounded-[10px] bg-white p-5">
          <View className="mb-3 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-[10px] bg-green-50">
              <Ionicons name="storefront-outline" size={21} color="#14532d" />
            </View>
            <Text className="flex-1 text-lg font-bold text-gray-900">
              Record walk-in sale
            </Text>
          </View>
          <Text className="mb-4 text-sm leading-5 text-gray-500">
            Para sa mga binili nang direkta sa farm (hindi dumaan sa app).
            Awtomatikong babawasan ang stock gamit ang FIFO (pinakamatandang
            batch muna) - kagaya rin ng ginagamit sa online orders.
          </Text>

          <View className="mb-4 rounded-[10px] bg-gray-50 px-4 py-3">
            <Text className="text-sm font-semibold text-gray-800">
              {product.name}
            </Text>
            <Text className="mt-1 text-sm text-gray-500">
              {product.stock} {product.unit} available
            </Text>
          </View>

          {error ? (
            <View className="mb-3 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2">
              <Text className="text-sm text-red-600">{error}</Text>
            </View>
          ) : null}

          <Text className="mb-1 text-xs font-semibold text-gray-600">
            QUANTITY NA NABENTA ({product.unit})
          </Text>
          <TextInput
            value={quantity}
            onChangeText={handleQuantityChange}
            keyboardType="numeric"
            placeholder={`Enter quantity (${product.unit})`}
            placeholderTextColor="#9ca3af"
            className="mb-5 rounded-[10px] border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800"
          />

          <View className="flex-row">
            <TouchableOpacity
              onPress={() => {
                resetForm();
                onClose();
              }}
              className="mr-2 flex-1 items-center rounded-[10px] border border-[#14532d] py-3"
            >
              <Text className="font-semibold text-[#14532d]">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={loading}
              className="ml-2 flex-1 items-center rounded-[10px] py-3"
              style={{
                backgroundColor: loading ? "#9ca3af" : "#14532d",
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">Record Sale</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RecordSaleModal;