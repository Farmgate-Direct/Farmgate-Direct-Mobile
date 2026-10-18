// Ranking of the best selling products, based on total units sold.
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ProductType } from "@/src/types/product";
import { subscribeToProducts } from "@/src/services/productService";

const LIMIT = 20;
const GREEN = "#14532d";

export default function TopProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToProducts((data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

const ranked = useMemo(
    () =>
      [...products]
        .filter((p: any) => Number(p.totalSales || 0) > 0)
        .sort(
          (a: any, b: any) => Number(b.totalSales || 0) - Number(a.totalSales || 0)
        )
        .slice(0, LIMIT),
    [products]
  );

const openProduct = (item: any) =>
    router.push({
      pathname: "/buyer/products/[id]",
      params: { id: item.docId || item.id || "" },
    } as any);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const img =
      item.image || item.imageUrl || (Array.isArray(item.images) ? item.images[0] : undefined);
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => openProduct(item)}
        className="bg-white py-3 flex-row items-center"
      >
        <Text className="w-7 mr-2 font-bold text-base text-gray-800 text-center">
          {index + 1}
        </Text>
        <View className="w-14 h-14 rounded-lg bg-green-50 overflow-hidden items-center justify-center mr-3">
          {img ? (
            <Image source={{ uri: img }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <MaterialCommunityIcons name="leaf" size={24} color="#86efac" />
          )}
        </View>
        <View className="flex-1">
          <Text className="font-bold text-gray-900" numberOfLines={1}>
            {item.name || item.productName || "Product"}
          </Text>
          <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
            {item.farmName || item.farmerName || "Local farm"}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: GREEN }}>
            {Number(item.totalSales || 0)} sold
          </Text>
        </View>
        {item.price != null && (
          <Text className="font-bold text-sm mr-1" style={{ color: GREEN }}>
            ₱{Number(item.price).toFixed(2)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl mb-1 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          className="mr-3 p-1.5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={25} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Top products</Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : ranked.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <MaterialCommunityIcons name="trophy-outline" size={40} color="#d1d5db" />
          <Text className="text-gray-500 font-semibold mt-3 text-center">
            Nothing to show yet
          </Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Rankings will appear once sales come in.
          </Text>
        </View>
      ) : (
        <FlatList
          data={ranked}
          keyExtractor={(item: any, i) => item.docId || item.id || i.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}