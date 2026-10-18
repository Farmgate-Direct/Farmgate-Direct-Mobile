// Ranking of the farmers selling the most, based on total units sold.
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

type FarmerRow = {
  farmerId: string;
  farmName: string;
  photo?: string;
  totalSales: number;
  productCount: number;
};

export default function TopFarmers() {
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

  // Adds up the sales of every product a farmer sells, then ranks farmers by
  // that total.
  const ranked = useMemo<FarmerRow[]>(() => {
    const map = new Map<string, FarmerRow>();
    products.forEach((p: any) => {
      const farmerId = p.farmerId || p.sellerId;
      if (!farmerId) return;
      const sales = Number(p.totalSales || 0);
      const existing = map.get(farmerId);
      if (existing) {
        existing.totalSales += sales;
        existing.productCount += 1;
      } else {
        map.set(farmerId, {
          farmerId,
          farmName: p.farmName || p.farmerName || "Farm",
          photo: p.farmPhoto || p.farmCoverPhoto,
          totalSales: sales,
          productCount: 1,
        });
      }
    });
    return [...map.values()]
      .filter((f) => f.totalSales > 0)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, LIMIT);
  }, [products]);

// Opens the shop of the farmer that was tapped.
  const openFarm = (farmerId: string) =>
    router.push({
      pathname: "/buyer/farm/[farmerId]",
      params: { farmerId },
    } as any);

  const renderItem = ({ item, index }: { item: FarmerRow; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => openFarm(item.farmerId)}
      className="bg-white py-3 flex-row items-center"
    >
      <Text className="w-7 mr-2 font-bold text-base text-gray-800 text-center">
        {index + 1}
      </Text>
      <View className="w-12 h-12 rounded-full bg-green-50 overflow-hidden items-center justify-center mr-3">
        {item.photo ? (
          <Image source={{ uri: item.photo }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Text className="font-bold text-lg" style={{ color: GREEN }}>
            {item.farmName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-900" numberOfLines={1}>
          {item.farmName}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5">
          {item.productCount} product{item.productCount === 1 ? "" : "s"} ·{" "}
          {item.totalSales} sold
        </Text>
      </View>
    </TouchableOpacity>
  );

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
        <Text className="text-white text-lg font-bold">Top-selling farmers</Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : ranked.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <MaterialCommunityIcons name="storefront-outline" size={40} color="#d1d5db" />
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
          keyExtractor={(item) => item.farmerId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}