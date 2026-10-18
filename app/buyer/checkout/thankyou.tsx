// Thank you screen after placing an order.
import { Ionicons } from "@expo/vector-icons";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import { useMemo } from "react";

import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { formatPhilippinePhoneNumber } from "@/utils/validators";

export default function ThankYou() {

  const {
    delivery,
    payment,
    subTotal,
    deliveryFee,
    total,

    fullName,
    street,
    barangay,
    city,
    province,
    phone,

    pickupDate,
    pickupTime,
  } = useLocalSearchParams();

  const orderDate =
    new Date().toLocaleString();

// Goes back to the buyer home screen.
  const handleHome = () => {
    router.replace(
      "/buyer/(tabs)/home"
    );
  };

  return (
    <View className="flex-1 bg-gray-100">

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        className="px-4"
      >

        <View className="items-center mt-32">

          <View className="bg-green-700 w-28 h-28 rounded-full items-center justify-center">

            <Ionicons
              name="checkmark"
              size={60}
              color="white"
            />

          </View>

          <Text className="text-2xl font-bold mt-6">
            Thank You!
          </Text>

          <Text className="text-gray-500">
            Your order has been placed.
          </Text>

        </View>

        <View className="bg-white rounded-2xl p-5 mt-6 mx-2">

          <Text className="text-lg font-bold mb-3">
            Order Receipt
          </Text>

          <Text className="text-xs text-gray-500 mb-4">
            Date: {orderDate}
          </Text>

          <View className="border-t mb-4" />

          <View className="mb-4">

            <Text className="font-semibold mb-1">
              {delivery === "pickup"
                ? "Pickup Details"
                : "Delivery Address"}
            </Text>

            <Text>{fullName}</Text>

            <Text>
              {street}, {barangay}
            </Text>

            <Text>
              {city}, {province}
            </Text>

            <Text>
              {Array.isArray(phone)
                ? formatPhilippinePhoneNumber(phone[0] || "")
                : formatPhilippinePhoneNumber(phone || "")}
            </Text>

            {delivery === "pickup" && (
              <>
                <Text className="mt-2">
                  Pickup Date: {pickupDate}
                </Text>

                <Text>
                  Pickup Time: {pickupTime}
                </Text>
              </>
            )}

          </View>

          <View className="border-t mb-4" />

          <View className="flex-row justify-between mb-3">

            <Text className="text-gray-500">
              Delivery Type
            </Text>

            <Text className="capitalize">
              {delivery}
            </Text>

          </View>

          <View className="flex-row justify-between mb-3">

            <Text className="text-gray-500">
              Payment Method
            </Text>

            <Text>
              {payment === "qr"
                ? "GCash"
                : "Cash on Delivery"}
            </Text>

          </View>

          <View className="flex-row justify-between mb-3">

            <Text className="text-gray-500">
              Subtotal
            </Text>

            <Text>
              ₱
              {Number(
                subTotal
              ).toFixed(2)}
            </Text>

          </View>

          <View className="flex-row justify-between mb-3">

            <Text className="text-gray-500">
              Delivery Fee
            </Text>

            <Text>
              ₱
              {Number(
                deliveryFee
              ).toFixed(2)}
            </Text>

          </View>

          <View className="flex-row justify-between mt-2">

            <Text className="font-bold text-base">
              Total
            </Text>

            <Text className="font-bold text-base">
              ₱
              {Number(
                total
              ).toFixed(2)}
            </Text>

          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white p-4">

        <TouchableOpacity
          onPress={() =>
            router.push(
              "/buyer/profile/orders"
            )
          }
          className="bg-green-700 py-4 rounded-xl mb-3"
        >

          <Text className="text-white text-center font-bold">
            Track Order
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleHome}
          className="border border-green-700 py-4 rounded-xl"
        >

          <Text className="text-green-700 text-center font-bold">
            Home
          </Text>

        </TouchableOpacity>
      </View>
    </View>
  );
}