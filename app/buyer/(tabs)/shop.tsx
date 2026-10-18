// Shop screen for buyers: search, category filter, and sorting.
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ProductCard from "@/components/ProductCard";
import Header_Buyer from "@/components/Header_Buyer";
import Category_Buyer from "@/components/Category_Filter";
import { ProductType } from "@/src/types/product";
import { subscribeToProducts } from "@/src/services/productService";
import { getCartByBuyer } from "@/src/services/cartService";

const SORT_OPTIONS = [
  { label: "All", icon: "options-outline" },
  { label: "Highest Rated", icon: "star-outline" },
  { label: "Best Selling", icon: "flame-outline" },
];

export default function Shop() {
  const router = useRouter();

  const [products, setProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("All");
  const [sortDropdownVisible, setSortDropdownVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const sortButtonRef = useRef<View>(null);
  const [cartCount, setCartCount] = useState(0);

  // Position the sort dropdown below the sort button.
  const openSortDropdown = () => {
    sortButtonRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      setDropdownPos({
        top: y + height + 6,
        right: screenWidth - (x + width),
      });
      setSortDropdownVisible(true);
    });
  };

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = subscribeToProducts((data) => {
        setProducts(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const loadCartCount = async () => {
        try {
          const userString = await AsyncStorage.getItem("user");
          if (!userString) return;
          const user = JSON.parse(userString);
          const uid = user.uid || user.userId || user.id;
          const cartItems = await getCartByBuyer(uid);
          setCartCount(
            cartItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
          );
        } catch (error) {
          console.log("SHOP CART COUNT ERROR:", error);
        }
      };
      loadCartCount();
    }, [])
  );

  const filteredProducts = products
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.farmName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === "All" ||
        (item.category || "").trim().toLowerCase() === activeCategory.trim().toLowerCase();
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "Highest Rated":
          return (b.rating || 0) - (a.rating || 0);
        case "Best Selling":
          return (b.totalSales || 0) - (a.totalSales || 0);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#14532d" />
        <Text className="mt-3 text-green-900 font-semibold text-sm">
          Loading products…
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      <FlatList
        data={filteredProducts}
        keyExtractor={(item, index) => item.docId ?? index.toString()}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 112 }}
        columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 14 }}
        ListHeaderComponent={
          <>
            <Header_Buyer
              cartCount={cartCount}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            <Category_Buyer activeCategory={activeCategory} onSelectCategory={setActiveCategory} />

            <View className="flex-row justify-end items-center mb-2 px-4">
              <TouchableOpacity
                ref={sortButtonRef}
                onPress={() =>
                  sortDropdownVisible
                    ? setSortDropdownVisible(false)
                    : openSortDropdown()
                }
                className="flex-row items-center bg-white px-3 py-1.5 rounded-full"
              >
                <Ionicons name="swap-vertical" size={14} color="#6b7280" />
                <Text className="text-gray-500 text-xs font-semibold ml-1">
                  Sort: {sortBy}
                </Text>
                <Ionicons
                  name={sortDropdownVisible ? "chevron-up" : "chevron-down"}
                  size={12}
                  color="#6b7280"
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View className="items-center py-20">
            <Text className="text-5xl mb-3">🌿</Text>
            <Text className="text-gray-600 font-bold text-base">No products found</Text>
            <Text className="text-gray-400 text-sm mt-1">
              Try a different search or category
            </Text>
          </View>
        }
        renderItem={({ item }) => <ProductCard item={item} />}
      />

      {/* Anchored under the sort button that opened it. */}
      <Modal
        visible={sortDropdownVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSortDropdownVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1"
          onPress={() => setSortDropdownVisible(false)}
        >
          <View
            className="absolute bg-white rounded-[14px] py-1.5"
            style={{
              top: dropdownPos.top,
              right: dropdownPos.right,
              width: 180,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 10,
              elevation: 8,
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.label;
              return (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => {
                    setSortBy(opt.label);
                    setSortDropdownVisible(false);
                  }}
                  className={`flex-row items-center justify-between px-3.5 py-2.5 ${
                    active ? "bg-green-50" : ""
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={active ? "#14532d" : "#6b7280"}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        active ? "text-green-900" : "text-gray-700"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={16} color="#14532d" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}