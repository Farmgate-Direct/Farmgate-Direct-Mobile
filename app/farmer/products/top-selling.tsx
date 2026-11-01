// Farmer top selling products screen.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../../FirebaseConfig";
import { ProductType } from "../../../src/types/product";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

export default function TopSellingProducts() {
  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    const loadProducts = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (!storedUser) {
          setLoading(false);
          return;
        }

        const user = JSON.parse(storedUser);
        const id = String(user.uid || user.userId || user.id || "");
        if (!id) {
          setLoading(false);
          return;
        }

        if (!active) return;

        const productsQuery = query(
          collection(db, "products"),
          where("farmerId", "==", id)
        );
        unsubscribe = onSnapshot(
          productsQuery,
          (snapshot) => {
            if (!active) return;
            setProducts(
              snapshot.docs.map(
                (product) =>
                  ({
                    docId: product.id,
                    ...product.data(),
                  }) as ProductType
              )
            );
            setLoading(false);
          },
          (error) => {
            getUserFriendlyErrorMessage(error, "Load farmer top-selling products");
            setLoading(false);
          }
        );
      } catch (error) {
        getUserFriendlyErrorMessage(error, "Load farmer top-selling products");
        setLoading(false);
      }
    };

    loadProducts();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const sortedProducts = useMemo(
    () =>
      [...products].sort(
        (a, b) => Number(b.totalSales || 0) - Number(a.totalSales || 0)
      ),
    [products]
  );

  return (
    <View className="flex-1 bg-[#f5f5f5]">
      <View className="flex-row items-center bg-[#14532d] px-5 pb-5 pt-14">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-white">Top selling products</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#14532d" />
        </View>
      ) : (
        <FlatList
          data={sortedProducts}
          keyExtractor={(item) => item.docId}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 32,
            flexGrow: sortedProducts.length === 0 ? 1 : 0,
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Ionicons name="bar-chart-outline" size={48} color="#9ca3af" />
              <Text className="mt-3 text-sm text-gray-500">
                No recorded sales yet.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View className="mb-3 flex-row items-center rounded-[5px] bg-white p-4">
              <Text className="mr-3 w-6 text-center text-sm font-bold text-gray-500">
                {index + 1}
              </Text>
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  className="h-12 w-12 rounded-[5px]"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-12 w-12 items-center justify-center rounded-[5px] bg-gray-100">
                  <Ionicons name="leaf-outline" size={22} color="#9ca3af" />
                </View>
              )}
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="mt-1 text-xs text-gray-500">
                  {item.archived ? "Archived · " : ""}
                  {item.unit.replace(/^per\s+/i, "")}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-base font-bold text-[#14532d]">
                  {Number(item.totalSales || 0).toLocaleString("en-PH")}
                </Text>
                <Text className="text-[11px] text-gray-500">sold</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
