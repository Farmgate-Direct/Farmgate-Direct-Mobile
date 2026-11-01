// Green header for buyer screens, holding search, cart, and notifications.
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

interface Props {
  // The search box only appears when onSearchChange is provided.
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  placeholder?: string;
  // The notification button only appears when onNotificationPress is provided.
  notificationCount?: number;
  onNotificationPress?: () => void;
  // Total quantity of items currently in the buyer's cart.
  cartCount?: number;
}

// Renders the search box next to the cart and notification buttons.
export default function BuyerHeader({
  searchQuery = "",
  onSearchChange,
  placeholder = "Search vegetables, fruits…",
  notificationCount = 0,
  onNotificationPress,
  cartCount = 0,
}: Props) {
  const router = useRouter();

  return (
    <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl mb-1">
      <View className="flex-row items-center gap-2.5">
        {onSearchChange ? (
          <View className="flex-1 flex-row items-center bg-white rounded-xl px-3 py-1.5 gap-2">
            <MaterialCommunityIcons name="magnify" size={16} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              className="flex-1 text-gray-900 text-sm"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange("")}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Push icons right when search is hidden.
          <View className="flex-1" />
        )}

        <TouchableOpacity
          onPress={() => router.push("/buyer/cart")}
          activeOpacity={0.85}
          className="p-1.5"
        >
          <MaterialCommunityIcons name="cart-outline" size={25} color="white" />
          {/* The badge is hidden when the cart is empty, and caps at 99+. */}
          {cartCount > 0 && (
            <View className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 items-center justify-center">
              <Text className="text-white text-[10px] font-bold">
                {cartCount > 99 ? "99+" : cartCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {onNotificationPress && (
          <TouchableOpacity
            onPress={onNotificationPress}
            activeOpacity={0.85}
            className="p-1.5"
          >
            <Ionicons name="notifications-outline" size={25} color="white" />
            {/* The badge is hidden when there is nothing to report, and caps at 99+. */}
            {notificationCount > 0 && (
              <View className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 items-center justify-center">
                <Text className="text-white text-[10px] font-bold">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}