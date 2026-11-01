// Buyer home screen with top products and saved farms.
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ProductCard from "@/src/components/buyer/ProductCard";
import BuyerHeader from "@/src/components/buyer/BuyerHeader";
import BuyerCategoryFilter from "@/src/components/buyer/BuyerCategoryFilter";
import { ProductType } from "@/src/types/product";
import { OrderType } from "@/src/types/order";

import { subscribeToProducts } from "@/src/services/productService";
import { getBuyerOrders } from "@/src/services/orderService";
import { getSavedFarms } from "@/src/services/savedFarmService";
import { getCartByBuyer } from "@/src/services/cartService";
import { useBuyerNotifications } from "@/src/hooks/useBuyerNotifications";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FARMER_CONTENT_BOTTOM_GAP,
} from "@/src/constants/farmerLayout";
import { getBuyerTabBarContentClearance } from "@/src/constants/buyerLayout";

const TOP_SELLING_LIMIT = 10;

type SavedFarm = {
  id: string;
  farmerId: string;
  farmName: string;
  coverPhoto?: string;
  municipality?: string;
  province?: string;
};

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderType[]>([]);
  const [showOtherOrders, setShowOtherOrders] = useState(false);
  const [savedFarms, setSavedFarms] = useState<SavedFarm[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const { unreadCount, inAppEnabled } = useBuyerNotifications();

  const [activeCategory, setActiveCategory] = useState("All");
  const [bannerIdx, setBannerIdx] = useState(0);
  const { width: SCREEN_WIDTH } = Dimensions.get("window");

  const BANNERS = [
    {
      id: "top-products",
      eyebrow: "CUSTOMER FAVORITES",
      title: "Top products",
      description: "Explore the products shoppers love most.",
      icon: "trophy-outline",
      backgroundColor: "#14532d",
      iconBackground: "#ffffff",
      iconColor: "#14532d",
      route: "/buyer/discover/top-products",
    },
    {
      id: "weekly-best-seller",
      eyebrow: "LAST 7 DAYS",
      title: "Best seller this week",
      description: "See what's selling across local farms.",
      icon: "calendar-week",
      backgroundColor: "#ecfdf5",
      iconBackground: "#d1fae5",
      iconColor: "#14532d",
      route: "/buyer/discover/weekly-best-seller",
    },
    {
      id: "top-farmers",
      eyebrow: "LOCAL FARM SPOTLIGHT",
      title: "Top-selling farmers",
      description: "Meet the farms behind the favorites.",
      icon: "storefront-outline",
      backgroundColor: "#fef3c7",
      iconBackground: "#fef3c7",
      iconColor: "#92400e",
      route: "/buyer/discover/top-farmers",
    },
  ];

  // Load orders, saved farms, and cart count.
  const loadHome = useCallback(async () => {
    try {
      setLoading(true);

      const userString = await AsyncStorage.getItem("user");
      if (!userString) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(userString);
      const uid = user.uid || user.userId || user.id;

      const [orders, farms, cartItems] = await Promise.all([
        getBuyerOrders(uid),
        getSavedFarms(uid) as Promise<SavedFarm[]>,
        getCartByBuyer(uid),
      ]);

      const active = orders.filter(
        (order) => order.status === "pending" || order.status === "processing"
      );
      setActiveOrders(active);
      setShowOtherOrders(false);
      setSavedFarms(farms);

      const count = cartItems.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0
      );
      setCartCount(count);
    } catch (error) {
      getUserFriendlyErrorMessage(error, "Load buyer home");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = subscribeToProducts((data) => setProducts(data));
      return () => unsubscribe();
    }, [])
  );

  const categoryFiltered =
    activeCategory === "All"
      ? products
      : products.filter(
          (p) =>
            (p.category || "").trim().toLowerCase() ===
            activeCategory.trim().toLowerCase()
        );

  const topSelling = [...categoryFiltered]
    .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0))
    .slice(0, TOP_SELLING_LIMIT);

  const activeOrder = activeOrders[0] || null;

  const openOrder = (order: OrderType) => {
    if (order.status === "pending") {
      router.push({
        pathname: "/buyer/checkout/orderreceipt",
        params: {
          orderIds: JSON.stringify([order.id || ""]),
          from: "orders",
        },
      });
      return;
    }

    router.push({
      pathname: "/buyer/profile/order-details",
      params: { orderId: order.id || "" },
    });
  };

  const hasAnyContent =
    activeOrders.length > 0 ||
    topSelling.length > 0 ||
    savedFarms.length > 0;

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#14532d" />
        <Text className="mt-3 text-green-900 font-semibold text-sm">
          Loading your home…
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: getBuyerTabBarContentClearance(
            insets.bottom,
            FARMER_CONTENT_BOTTOM_GAP
          ),
        }}
      >
        <BuyerHeader
          cartCount={cartCount}
          notificationCount={inAppEnabled ? unreadCount : 0}
          onNotificationPress={() => router.push("/buyer/notifications" as any)}
        />

        {/* Leaderboard banners. */}
        <View style={{ marginTop: 12, paddingHorizontal: 16 }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) =>
              setBannerIdx(
                Math.round(
                  event.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32)
                )
              )
            }
          >
            {BANNERS.map((banner) => (
              <TouchableOpacity
                key={banner.id}
                activeOpacity={0.88}
                onPress={() => router.push(banner.route as any)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${banner.title}`}
                style={{
                  width: SCREEN_WIDTH - 32,
                  height: 160,
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: banner.backgroundColor,
                  padding: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View className="flex-1 pr-3">
                  <Text
                    className="text-[10px] font-bold tracking-widest"
                    style={{
                      color:
                        banner.id === "top-products" ? "#bbf7d0" : "#6b7280",
                    }}
                  >
                    {banner.eyebrow}
                  </Text>
                  <Text
                    className="text-xl font-black mt-2"
                    style={{
                      color:
                        banner.id === "top-products" ? "#ffffff" : "#14532d",
                    }}
                  >
                    {banner.title}
                  </Text>
                  <Text
                    className="text-xs mt-1 leading-4"
                    style={{
                      color:
                        banner.id === "top-products" ? "#dcfce7" : "#4b5563",
                    }}
                  >
                    {banner.description}
                  </Text>
                  <View className="flex-row items-center mt-3">
                    <Text
                      className="font-bold text-xs mr-1"
                      style={{
                        color:
                          banner.id === "top-products" ? "#ffffff" : "#14532d",
                      }}
                    >
                      View list
                    </Text>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={15}
                      color={
                        banner.id === "top-products" ? "#ffffff" : "#14532d"
                      }
                    />
                  </View>
                </View>
                <View
                  className="w-16 h-16 rounded-full items-center justify-center"
                  style={{ backgroundColor: banner.iconBackground }}
                >
                  <MaterialCommunityIcons
                    name={banner.icon as any}
                    size={32}
                    color={banner.iconColor}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 5,
              marginTop: 8,
            }}
          >
            {BANNERS.map((banner, index) => (
              <View
                key={banner.id}
                style={{
                  width: bannerIdx === index ? 18 : 5,
                  height: 5,
                  borderRadius: 10,
                  backgroundColor: bannerIdx === index ? "#14532d" : "#d1d5db",
                }}
              />
            ))}
          </View>
        </View>

        <BuyerCategoryFilter activeCategory={activeCategory} onSelectCategory={setActiveCategory} />

        <View className="px-4">
          {/* Active order. */}
          {activeOrder && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-800 font-bold text-base">
                  Order in progress
                </Text>
                {activeOrders.length > 1 && (
                  <TouchableOpacity
                    onPress={() => setShowOtherOrders((visible) => !visible)}
                    className="flex-row items-center px-2 py-1"
                    accessibilityRole="button"
                    accessibilityLabel={
                      showOtherOrders ? "Hide other active orders" : "Show other active orders"
                    }
                  >
                    <Text className="text-xs font-semibold mr-1" style={{ color: "#14532d" }}>
                      {showOtherOrders
                        ? "Hide other orders"
                        : `Other orders (${activeOrders.length - 1})`}
                    </Text>
                    <MaterialCommunityIcons
                      name={showOtherOrders ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#14532d"
                    />
                  </TouchableOpacity>
                )}
              </View>

              <View className="bg-white rounded-[10px] border border-gray-100 px-3">
                {(showOtherOrders ? activeOrders : [activeOrder]).map(
                  (order, index) => (
                    <TouchableOpacity
                      key={order.id || `active-order-${index}`}
                      onPress={() => openOrder(order)}
                      className={`flex-row items-center justify-between py-3 ${
                        index !== 0 ? "border-t border-gray-100" : ""
                      }`}
                    >
                      <View className="flex-1 mr-3">
                        <Text
                          className="font-semibold text-sm text-gray-800"
                          numberOfLines={1}
                        >
                          {order.farmName || "Farm"}
                        </Text>
                        <Text className="text-gray-500 text-xs mt-1">
                          ₱{Number(order.total || 0).toFixed(2)}
                        </Text>
                      </View>
                      <Text
                        className="font-semibold text-xs"
                        style={{
                          color:
                            order.status === "pending"
                              ? "#D97706"
                              : "#14532d",
                        }}
                      >
                        {order.status === "pending"
                          ? "Pending"
                          : "Processing"}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          )}

          {/* Top selling products. */}
          {topSelling.length > 0 && (
            <View className="mb-6">
              <FlatList
                data={topSelling}
                scrollEnabled={false}
                numColumns={2}
                keyExtractor={(item, index) => item.docId ?? index.toString()}
                columnWrapperStyle={{ justifyContent: "space-between" }}
                renderItem={({ item }) => <ProductCard item={item} />}
              />
            </View>
          )}

          {/* Saved farms. */}
          {savedFarms.length > 0 && (
            <View className="mb-4">
              <Text className="text-gray-800 font-bold text-base mb-3">
                Your saved farms
              </Text>
              <FlatList
                data={savedFarms}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => item.id ?? index.toString()}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() =>
                      router.push({
                        pathname: "/buyer/farm/[farmerId]",
                        params: { farmerId: item.farmerId },
                      })
                    }
                    className="bg-white rounded-[10px] overflow-hidden border border-gray-100"
                    style={{ width: 150 }}
                  >
                    <View
                      className="bg-green-50 items-center justify-center overflow-hidden"
                      style={{ height: 64 }}
                    >
                      {item.coverPhoto ? (
                        <Image
                          source={{ uri: item.coverPhoto }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <MaterialCommunityIcons name="home-outline" size={24} color="#86efac" />
                      )}
                    </View>
                    <View className="p-2.5">
                      <Text
                        className="font-bold text-gray-900 text-[13px]"
                        numberOfLines={1}
                      >
                        {item.farmName}
                      </Text>
                      <Text className="text-gray-400 text-[10px] mt-0.5" numberOfLines={1}>
                        {item.municipality}, {item.province}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Empty state. */}
          {!hasAnyContent && (
            <View className="items-center py-10">
              <Text className="text-4xl mb-3">🌱</Text>
              <Text className="text-gray-600 font-semibold text-base text-center">
                Welcome to FarmGate Direct
              </Text>
              <Text className="text-gray-400 text-sm mt-1 text-center px-8">
                Head to Shop to find fresh produce from local farms.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/buyer/shop")}
                className="bg-green-900 px-6 py-3 rounded-xl mt-5"
              >
                <Text className="text-white font-bold text-sm">Browse Shop</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}