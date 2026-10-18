// Popup where the buyer picks how many units to add to the cart.
import { useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

export default function QuantityModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (qty: number) => void;
}) {
  const [qty, setQty] = useState(1);

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View className="flex-1 bg-black/40 justify-center items-center">
        <View className="bg-white w-80 rounded-2xl p-5">
          <Text className="text-lg font-bold text-center mb-4">
            Select Quantity
          </Text>

          <View className="flex-row justify-center items-center mb-6">
            {/* The minimum order is one unit. */}
            <TouchableOpacity
              onPress={() => qty > 1 && setQty(qty - 1)}
              className="bg-gray-200 px-4 py-2 rounded-full"
            >
              <Text className="text-xl">−</Text>
            </TouchableOpacity>

            <Text className="mx-6 text-xl font-bold">{qty}</Text>

            <TouchableOpacity
              onPress={() => setQty(qty + 1)}
              className="bg-gray-200 px-4 py-2 rounded-full"
            >
              <Text className="text-xl">+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              onConfirm(qty);
              // Start the next time the popup opens from one again.
              setQty(1);
            }}
            className="bg-green-700 py-3 rounded-xl"
          >
            <Text className="text-white text-center font-bold">
              Confirm
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} className="mt-3">
            <Text className="text-center text-gray-500">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
