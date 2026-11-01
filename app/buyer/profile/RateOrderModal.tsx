// Modal where a buyer rates and reviews a product they ordered.
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
import { addReview } from "@/src/services/productService";
import { markProductReviewed } from "@/src/services/orderService";
import { OrderProduct } from "@/src/types/order";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../FirebaseConfig";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

type Props = {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  product: OrderProduct | null;
  buyerId: string;
  buyerName: string;
  buyerProfileImage?: string; 
  // Called after a review is saved, so the parent screen (orders.tsx) can update
  // its own state and hide the Rate button without refetching the whole list.
  onSubmitted: (productId: string) => void;
};

// Rating popup shown when the buyer taps Rate on a delivered order.
const RateOrderModal = ({
  visible,
  onClose,
  orderId,
  product,
  buyerId,
  buyerName,
  buyerProfileImage,
  onSubmitted,
}: Props) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setRating(5);
    setComment("");
    setError("");
  };

  const handleSubmit = async () => {
    if (!product) return;
    if (!comment.trim()) {
      setError("Please write a short review.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      let profileImage = buyerProfileImage || "";
      if (!profileImage && buyerId) {
        const buyerDoc = await getDoc(doc(db, "users", buyerId));
        profileImage = buyerDoc.exists()
          ? buyerDoc.data().profileImage || ""
          : "";
      }

      await addReview({
        productId: product.productId,
        orderProduct: product,
        variationId: product.variationId || null,
        variationName: product.variationName || "",
        orderId,
        buyerId,
        buyerName,
        buyerProfileImage: profileImage,
        rating,
        comment: comment.trim(),
        createdAt: Date.now(),
      });

      await markProductReviewed(orderId, product.productId);

      onSubmitted(product.productId);
      resetForm();
      onClose();
    } catch (err) {
      setError(
        getUserFriendlyErrorMessage(
          err,
          "Submit buyer product review",
          "We couldn't submit your review right now. Please try again in a moment."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black/40 justify-center px-6">
        <View
          className="bg-white rounded-[10px] p-6"
          style={{ borderWidth: 1, borderColor: "#14532d" }}
        >
          <Text className="text-lg font-bold mb-1">Rate this product</Text>
          <Text className="text-xs text-gray-400 mb-4">{product.name}</Text>

          {error ? <Text className="text-red-500 text-xs mb-3">{error}</Text> : null}

          <View className="flex-row justify-center mb-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} className="px-1">
                <Ionicons
                  name={s <= rating ? "star" : "star-outline"}
                  size={32}
                  color="#f59e0b"
                />
              </TouchableOpacity>
            ))}
          </View>


          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Kumusta ang produkto? (freshness, sukat, atbp.)"
            className="bg-gray-100 px-4 py-3 rounded-[5px] mb-4 h-24 border border-gray-300"
          />

            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => {
                    resetForm();
                    onClose();
                  }}
                  className="w-[48%] py-3 rounded-[5px] items-center"
                  style={{ borderWidth: 1, borderColor: "#14532d" }}
                >
                <Text style={{ color: "#14532d" }} className="font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitting}
                    className="w-[48%] py-3 rounded-[5px] items-center"
                    style={{ backgroundColor: submitting ? "#9ca3af" : "#14532d" }}
                  >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold">Submit</Text>
                  )}
                </TouchableOpacity>
            </View>
        </View>
      </View>
    </Modal>
  );
};

export default RateOrderModal;