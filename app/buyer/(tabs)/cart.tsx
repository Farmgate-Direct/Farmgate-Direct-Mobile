// Buyer cart screen grouped by farm.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useToast } from "@/src/context/ToastContext";
import { useAppAlert } from "@/src/context/FarmerAlertContext";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BUYER_TAB_BAR_HEIGHT,
  getBuyerTabBarContentClearance,
} from "@/src/constants/buyerLayout";
import { FARMER_CONTENT_BOTTOM_GAP } from "@/src/constants/farmerLayout";
import React, { useCallback, useState } from "react";
import { getProductById } from "@/src/services/productService";

import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getCartByBuyer,
  removeCartItem,
  updateCartQuantity,
} from "@/src/services/cartService";

import {
  groupCartByFarmer,
  FarmerCart,
} from "@/src/utils/groupCartByFarmer";

import { CartItem } from "@/src/types/cart";
import type { ProductType } from "@/src/types/product";

const stockKey = (productId: string, variationId: string) =>
  `${productId}::${variationId}`;

export default function Cart() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const Alert = useAppAlert();
  const [cartItems, setCartItems] = useState<FarmerCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockMap, setStockMap] = useState<Record<string, number | null>>({});
  const [checkingStock, setCheckingStock] = useState(false);

  const [selectedItems, setSelectedItems] = useState<Set<string>>( new Set() );

  const [buyerId, setBuyerId] = useState("");

  const [removeTarget, setRemoveTarget] = useState<{
    farmerId: string;
    docId: string;
    name: string;
  } | null>(null);

// Load cart items for this buyer.
  const loadCart = useCallback(async () => {
    try {
      setLoading(true);

      const userString = await AsyncStorage.getItem("user");

      if (!userString) {
        router.replace("../login");
        return;
      }

      const user = JSON.parse(userString);

      const uid = user.uid || user.userId || user.id;

      setBuyerId(uid);

      const items: CartItem[] = await getCartByBuyer(uid);

      // Load stock for each selected variation to limit cart quantity changes.
      const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
      const productEntries = await Promise.all(
        uniqueProductIds.map(async (productId) => {
          try {
            return [productId, await getProductById(productId)] as const;
          } catch (error) {
            getUserFriendlyErrorMessage(error, "Load cart product stock");
            return [productId, null] as const;
          }
        })
      );
      const productsById = new Map<string, ProductType | null>(productEntries);
      const refreshedItems = items.map((item) => {
        const product = productsById.get(item.productId);
        const variation = product?.variations.find(
          (entry) => entry.id === item.variationId
        );
        return product && variation
          ? {
              ...item,
              name: product.name,
              image: product.image,
              variationName: variation.name,
              price: variation.price,
              unit: variation.unit,
            }
          : item;
      });
      setCartItems(groupCartByFarmer(refreshedItems));

      const stockEntries = items.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) return [stockKey(item.productId, item.variationId), null] as const;
        const variation = product.variations.find(
          (entry) => entry.id === item.variationId
        );
        const available =
          !product.archived && variation?.status === "Available"
            ? variation.stock
            : 0;
        return [stockKey(item.productId, item.variationId), available] as const;
      });
      setStockMap(Object.fromEntries(stockEntries));

    } catch (error) {
      Alert.alert(
        "Cart unavailable",
        getUserFriendlyErrorMessage(
          error,
          "Load buyer cart",
          "We couldn't load your cart. Please try again in a moment."
        )
      );
    } finally {
      setLoading(false);
    }

  }, [Alert, router]);

  useFocusEffect(
    useCallback(() => {
      void loadCart();
    }, [loadCart])
  );

  const toggleItemSelection = (docId: string) => {
    setSelectedItems((prev) => {
      const copy = new Set(prev);

      if (copy.has(docId)) {
        copy.delete(docId);
      } else {
        copy.add(docId);
      }

      return copy;
    });
  };

  const toggleFarmSelection = (farmerId: string) => {
    const farmProducts =
      cartItems
        .find((f) => f.farmerId === farmerId)
        ?.products.map((p) => p.docId!) || [];

    setSelectedItems((prev) => {
      const copy = new Set(prev);

      const allSelected = farmProducts.every((id) =>
        copy.has(id)
      );

      if (allSelected) {
        farmProducts.forEach((id) => copy.delete(id));
      } else {
        farmProducts.forEach((id) => copy.add(id));
      }

      return copy;
    });
  };

  const updateLocalQty = (
    farmerId: string,
    docId: string,
    qty: number
  ) => {
    setCartItems((prev) =>
      prev.map((f) =>
        f.farmerId === farmerId
          ? {
              ...f,
              products: f.products.map((p) =>
                p.docId === docId
                  ? { ...p, quantity: qty }
                  : p
              ),
            }
          : f
      )
    );
  };

  // Increase item quantity within the stock limit.
  const incrementQty = async (farmerId: string, docId: string) => {
  const product = cartItems
    .find((f) => f.farmerId === farmerId)
    ?.products.find((p) => p.docId === docId);

  if (!product?.docId) return;

  const key = stockKey(product.productId, product.variationId);
  const availableStock = stockMap[key];

  if (typeof availableStock !== "number") {
    showToast("Unable to verify stock. Please refresh the cart and try again.");
    return;
  }

  const maxQty = Math.floor(availableStock);

  if (product.quantity >= maxQty) {
    showToast(
      `Only ${availableStock} ${product.unit?.replace(/^per\s+/i, "")} available for ${product.variationName}.`
    );
    return;
  }

  const newQty = product.quantity + 1;
  updateLocalQty(farmerId, docId, newQty);

  try {
    await updateCartQuantity(product.docId, newQty);
  } catch (error) {
    updateLocalQty(farmerId, docId, product.quantity);
    Alert.alert(
      "Couldn't update quantity",
      getUserFriendlyErrorMessage(
        error,
        "Increase cart item quantity",
        "We couldn't update this quantity. Please try again."
      )
    );
  }

  
};

  // Decrease quantity down to a minimum of 1. Use the delete button to remove an item.
  const decrementQty = async (
    farmerId: string,
    docId: string
  ) => {
    const product = cartItems
      .find((f) => f.farmerId === farmerId)
      ?.products.find((p) => p.docId === docId);

    if (!product?.docId) return;

    if (product.quantity <= 1) return;

    const newQty = product.quantity - 1;

    updateLocalQty(farmerId, docId, newQty);

    try {
      await updateCartQuantity(product.docId, newQty);
    } catch (error) {
      updateLocalQty(
        farmerId,
        docId,
        product.quantity
      );

      Alert.alert(
        "Couldn't update quantity",
        getUserFriendlyErrorMessage(
          error,
          "Decrease cart item quantity",
          "We couldn't update this quantity. Please try again."
        )
      );
    }
  };

  const removeItem = async (
    farmerId: string,
    docId: string
  ) => {
    const product = cartItems
      .find((f) => f.farmerId === farmerId)
      ?.products.find((p) => p.docId === docId);

    if (!product?.docId) return;

    const backup = [...cartItems];

    setCartItems((prev) =>
      prev
        .map((f) =>
          f.farmerId === farmerId
            ? {
                ...f,
                products: f.products.filter(
                  (p) => p.docId !== docId
                ),
              }
            : f
        )
        .filter((f) => f.products.length > 0)
    );

    setSelectedItems((prev) => {
      const copy = new Set(prev);

      copy.delete(docId);

      return copy;
    });

    try {
      await removeCartItem(product.docId);
    } catch (error) {
      setCartItems(backup);

      Alert.alert(
        "Couldn't remove item",
        getUserFriendlyErrorMessage(
          error,
          "Remove buyer cart item",
          "We couldn't remove this item. Please try again."
        )
      );
    }
  };

  const confirmRemove = (farmerId: string, docId: string, name: string) => {
    setRemoveTarget({ farmerId, docId, name });
  };

  const handleConfirmedRemove = () => {
    if (removeTarget) {
      removeItem(removeTarget.farmerId, removeTarget.docId);
    }
    setRemoveTarget(null);
  };

  // Check selected stock before going to checkout.
  const validateSelectedStockBeforeCheckout = async () => {
    const selectedProducts = cartItems.flatMap((farm) =>
      farm.products.filter((p) => selectedItems.has(p.docId!))
    );

    if (selectedProducts.length === 0) {
      showToast("Please select at least one item to checkout");
      return false;
    }

    const requestedMap = new Map<
      string,
      {
        productId: string;
        variationId: string;
        variationName: string;
        quantity: number;
        name: string;
        unit: string;
      }
    >();

    selectedProducts.forEach((product) => {
      const productId = String(product.productId || "").trim();
      if (!productId) {
        throw new Error(`Product ID is missing for ${product.name || "a selected item"}.`);
      }

      const variationId = String(product.variationId || "").trim();
      if (!variationId) {
        throw new Error(`Variation is missing for ${product.name || "a selected item"}.`);
      }
      const key = stockKey(productId, variationId);
      const current = requestedMap.get(key);
      requestedMap.set(key, {
        productId,
        variationId,
        variationName: product.variationName,
        quantity: (current?.quantity || 0) + product.quantity,
        name: current?.name || product.name || "Product",
        unit: current?.unit || product.unit || "unit",
      });
    });

    setCheckingStock(true);

    try {
      const checks = await Promise.all(
        Array.from(requestedMap.entries()).map(async ([key, requested]) => {
          try {
            const product = await getProductById(requested.productId);
            const variation = product?.variations.find(
              (entry) => entry.id === requested.variationId
            );
            const available =
              variation?.status === "Available" ? variation.stock : 0;
            return { key, ...requested, available };
          } catch (error) {
            getUserFriendlyErrorMessage(
              error,
              "Verify stock before buyer checkout"
            );
            return { key, ...requested, available: null };
          }
        })
      );

      setStockMap((prev) => ({
        ...prev,
        ...Object.fromEntries(
        checks.map((item) => [item.key, item.available])
        ),
      }));

      const failedVerification = checks.filter(
        (item) => item.available === null
      );

      if (failedVerification.length > 0) {
        Alert.alert(
          "Unable to Verify Stock",
          "FarmGate could not verify the current stock of one or more products. Please refresh the cart and try again."
        );
        return false;
      }

      const shortages = checks.filter(
        (item) => Number(item.quantity) > Number(item.available)
      );

      if (shortages.length > 0) {
        const message = shortages
          .map(
            (item) =>
              `${item.name} (${item.variationName}): requested ${item.quantity}, available ${item.available} ${String(item.unit).replace(/^per\s+/i, "")}`
          )
          .join("\n");

        Alert.alert(
          "Insufficient Stock",
          `You cannot checkout yet because the selected quantity is higher than the current stock.\
\
${message}`
        );
        return false;
      }

      return true;
    } catch (error: any) {
      Alert.alert(
        "Unable to Verify Stock",
        getUserFriendlyErrorMessage(
          error,
          "Validate buyer cart stock",
          "We couldn't check product availability right now. Please try again in a moment."
        )
      );
      return false;
    } finally {
      setCheckingStock(false);
    }
  };

  // Total price of selected items.
  const totalPrice = cartItems.reduce((acc, farm) => {
    const farmTotal = farm.products.reduce((sum, p) => {
      if (selectedItems.has(p.docId!)) {
        return sum + p.price * p.quantity;
      }

      return sum;
    }, 0);

    return acc + farmTotal;
  }, 0);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator
          size="large"
          color="#14532d"
        />
      </View>
    );
  }

  if (cartItems.length === 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: "#f5f5f5" }}>
        <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="white"
            />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg ml-4">
            My Cart
          </Text>
        </View>
        <Text className="text-center mt-10 text-gray-500">
          Your cart is empty
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#fafafa" }}>

      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="white"
          />
        </TouchableOpacity>

        <Text className="text-white font-bold text-lg ml-4">
          My Cart
        </Text>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(f) => f.farmerId}
        contentContainerStyle={{
          padding: 16,
          paddingBottom:
            getBuyerTabBarContentClearance(
              insets.bottom,
              FARMER_CONTENT_BOTTOM_GAP
            ) + 72,
        }}
        renderItem={({ item: farm, index }) => (
            <View
              className={`rounded-[10px] p-4 ${
                index < cartItems.length - 1 ? "mb-4" : ""
              }`}
              style={{ backgroundColor: "#ffffff" }}
            >

            <View className="flex-row items-center mb-2">

              <TouchableOpacity
                onPress={() =>
                  toggleFarmSelection(farm.farmerId)
                }
                className="mr-3"
              >
                <MaterialCommunityIcons
                  name={
                    farm.products.every((p) =>
                      selectedItems.has(p.docId!)
                    )
                      ? "checkbox-marked"
                      : "checkbox-blank-outline"
                  }
                  size={20}
                  color="#14532d"
                />
              </TouchableOpacity>

              <Text className="font-bold text-lg">
                {farm.farmName}
              </Text>
            </View>

            {farm.products.map((p, index) => (
              <View
                key={p.docId}
                className={`py-4 ${
                  index < farm.products.length - 1
                    ? "border-b border-gray-200"
                    : ""
                }`}
              >
                <View className="flex-row items-start">

                  <TouchableOpacity
                    onPress={() =>
                      toggleItemSelection(p.docId!)
                    }
                    className="mr-3 mt-1"
                  >
                    <MaterialCommunityIcons
                      name={
                        selectedItems.has(p.docId!)
                          ? "checkbox-marked"
                          : "checkbox-blank-outline"
                      }
                      size={22}
                      color="#14532d"
                    />
                  </TouchableOpacity>

                  {/* Product details. */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: "/buyer/products/[id]",
                        params: { id: p.productId },
                      })
                    }
                    className="flex-1 flex-row items-start"
                  >
                    <View
                      className="rounded-lg overflow-hidden"
                      style={{ width: 80, height: 80 }}
                    >
                      <Image
                        source={{ uri: p.image }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    </View>

                    <View className="flex-1 ml-3 justify-center">

                      <Text className="font-bold text-base" numberOfLines={1}>
                        {p.name}
                      </Text>

                      <Text className="text-green-900 font-bold mt-1">
                        ₱{p.price.toFixed(2)}
                      </Text>

                      {p.variationName ? (
                        <Text className="text-green-900 text-xs mt-0.5 font-semibold">
                          {p.variationName}
                        </Text>
                      ) : (
                        <Text className="text-orange-700 text-xs mt-0.5">
                          Remove and add again to choose a variation.
                        </Text>
                      )}

                      <Text className="text-gray-500 text-xs mt-0.5">
                        Total: {p.quantity} {p.unit?.replace(/^per\s+/i, "")}
                      </Text>

                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() =>
                      confirmRemove(farm.farmerId, p.docId!, p.name)
                    }
                    style={{ position: "absolute", top: 12, right: 0 }}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={18}
                      color="#dc2626"
                    />
                  </TouchableOpacity>

                  <View className="flex-row items-center ml-2" style={{ marginTop: 50 }}>
                    <TouchableOpacity
                      onPress={() => decrementQty(farm.farmerId, p.docId!)}
                      className="w-7 h-7 rounded-[5px] items-center justify-center"
                      style={{ borderWidth: 1, borderColor: "#14532d" }}
                    >
                      <MaterialCommunityIcons name="minus" size={14} color="#14532d" />
                    </TouchableOpacity>

                    <Text className="mx-2 text-sm font-semibold text-gray-800">
                      {p.quantity}
                    </Text>

                    <TouchableOpacity
                      onPress={() => incrementQty(farm.farmerId, p.docId!)}
                      disabled={
                        !p.variationId ||
                        typeof stockMap[stockKey(p.productId, p.variationId)] !== "number" ||
                        p.quantity >= Math.floor(stockMap[stockKey(p.productId, p.variationId)] as number)
                      }
                      className="w-7 h-7 rounded-[5px] items-center justify-center"
                      style={{
                        backgroundColor:
                          !p.variationId ||
                          typeof stockMap[stockKey(p.productId, p.variationId)] !== "number" ||
                          p.quantity >= Math.floor(stockMap[stockKey(p.productId, p.variationId)] as number)
                            ? "#9ca3af"
                            : "#14532d",
                      }}
                    >
                      <MaterialCommunityIcons name="plus" size={14} color="white" />
                    </TouchableOpacity>
                  </View>

                </View>

              </View>
            ))}
          </View>
        )}
      />

      <View
        className="absolute left-0 right-0 bg-white border-t border-gray-200 flex-row items-stretch"
        style={{
          bottom: BUYER_TAB_BAR_HEIGHT + insets.bottom,
        }}
      >
        <View className="flex-1 justify-center px-4 py-5">
          <Text className="text-lg font-bold">
            Total: ₱{totalPrice.toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={async () => {
            if (!buyerId) {
              showToast("Buyer not logged in");
              return;
            }

            const stockIsEnough =
              await validateSelectedStockBeforeCheckout();

            if (!stockIsEnough) {
              return;
            }

            const itemsToCheckout = cartItems
              .map((farm) => ({
                farmerId: farm.farmerId,
                farmName: farm.farmName,
                products: farm.products.filter((p) =>
                  selectedItems.has(p.docId!)
                ),
              }))
              .filter((farm) => farm.products.length > 0);

            router.push({
              pathname: "/buyer/checkout",
              params: {
                items: JSON.stringify(itemsToCheckout),
                buyerId,
              },
            });
          }}
          disabled={checkingStock}
          className="bg-green-900 px-8 items-center justify-center"
        >
          <Text className="text-white font-bold">
            {checkingStock ? "Checking Stock..." : "Checkout"}
          </Text>
        </TouchableOpacity>
      </View>

      {removeTarget && (
        <View className="absolute inset-0 justify-center items-center bg-black/40">
          <View
            className="bg-white rounded-[10px] p-6 w-80"
            style={{ borderWidth: 1, borderColor: "#14532d" }}
          >
            <Text className="text-gray-800 text-lg font-semibold mb-2">
              Remove item
            </Text>
            <Text className="text-gray-500 text-sm mb-4">
              Remove {removeTarget.name} from your cart?
            </Text>

            <View className="flex-row justify-between mt-4">
              <TouchableOpacity
                className="bg-gray-200 px-4 py-2 rounded-[5px] flex-1 mr-2 items-center"
                onPress={() => setRemoveTarget(null)}
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="px-4 py-2 rounded-[5px] flex-1 ml-2 items-center"
                style={{ backgroundColor: "#dc2626" }}
                onPress={handleConfirmedRemove}
              >
                <Text className="text-white font-semibold">Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}