// Farmer bottom tab bar with badges.
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "../../../FirebaseConfig";
import { listenChats } from "../../../src/services/chatService";
import { getLastChatSenderId } from "../../../src/utils/chatMessage";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";
import { FARMER_TAB_BAR_HEIGHT } from "@/src/constants/farmerLayout";

const TABS = [
  {
    name: "home",
    icon: "home",
    outlineIcon: "home-outline",
    href: "/farmer/(tabs)/home",
    label: "Home",
  },
  {
    name: "product",
    icon: "add-circle",
    outlineIcon: "add-circle-outline",
    href: "/farmer/(tabs)/product",
    label: "Product list",
  },
  {
    name: "order",
    icon: "cube",
    outlineIcon: "cube-outline",
    href: "/farmer/(tabs)/order",
    label: "Orders",
  },
  {
    name: "message",
    icon: "chatbubble-ellipses",
    outlineIcon: "chatbubble-ellipses-outline",
    href: "/farmer/(tabs)/message",
    label: "Messages",
  },
  {
    name: "profile",
    icon: "person",
    outlineIcon: "person-outline",
    href: "/farmer/(tabs)/profile",
    label: "Profile",
  },
] as const;

// Orders and chats store dates in different shapes, so the badge counts need
// milliseconds.
const getTimestampMillis = (value: any): number => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const millis = Number(value || 0);
  return Number.isFinite(millis) ? millis : 0;
};

// Draws the tab bar and adds the unread dots on Orders and Message.
function CustomTabBar() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const active = segments[segments.length - 1] ?? "home";
  const [farmerId, setFarmerId] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [ordersSeenAt, setOrdersSeenAt] = useState(0);
  const [seenMarkersLoaded, setSeenMarkersLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadFarmer = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (!storedUser) {
          if (!cancelled) setSeenMarkersLoaded(true);
          return;
        }

        const user = JSON.parse(storedUser);
        const id = user.uid || user.userId || user.id || "";
        if (!id) {
          if (!cancelled) setSeenMarkersLoaded(true);
          return;
        }

        const ordersSeen = await AsyncStorage.getItem(
          `farmer-orders-seen-${id}`
        );
        if (cancelled) return;

        setFarmerId(id);
        setOrdersSeenAt(Number(ordersSeen) || 0);
        setSeenMarkersLoaded(true);
      } catch (error) {
        getUserFriendlyErrorMessage(error, "Load farmer tab indicators");
        if (!cancelled) setSeenMarkersLoaded(true);
      }
    };

    loadFarmer();
    return () => {
      cancelled = true;
    };
  }, []);

useEffect(() => {
    if (!farmerId) return;

    const ordersQuery = query(
      collection(db, "orders"),
      where("farmerId", "==", farmerId)
    );
    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        setOrders(snapshot.docs.map((item) => item.data()));
      },
      (error) => getUserFriendlyErrorMessage(error, "Load farmer order indicators")
    );
    const unsubscribeChats = listenChats(
      farmerId,
      setChats,
      (error) => getUserFriendlyErrorMessage(error, "Load farmer message indicators")
    );

    return () => {
      unsubscribeOrders();
      unsubscribeChats();
    };
  }, [farmerId]);

  useEffect(() => {
    if (!farmerId || !seenMarkersLoaded) return;

    const now = Date.now();
    if (active === "order") {
      setOrdersSeenAt(now);
      AsyncStorage.setItem(`farmer-orders-seen-${farmerId}`, String(now)).catch(
        (error) =>
          getUserFriendlyErrorMessage(error, "Save farmer order read status")
      );
    }
  }, [active, farmerId, seenMarkersLoaded]);

  const newOrdersCount = orders.filter(
    (order) =>
      order.status === "pending" &&
      getTimestampMillis(order.createdAt) > ordersSeenAt
  ).length;
  const newMessagesCount = chats.filter((chat) => {
    const lastSender = getLastChatSenderId(chat);
    const lastReadAt = chat.lastReadAt?.[farmerId];
    return (
      (!lastSender || lastSender !== farmerId) &&
      getTimestampMillis(chat.lastMessageTime || chat.updatedAt) >
        getTimestampMillis(lastReadAt)
    );
  }).length;

  return (
    <View style={[styles.barWrapper, { height: BAR_H + insets.bottom }]}>
      <View
        pointerEvents="none"
        style={[styles.systemNavigationArea, { height: insets.bottom }]}
      />
      <View style={[styles.bar, { bottom: insets.bottom }]}>
        {TABS.map((tab) => {
          const focused = active === tab.name;
          const indicatorCount =
            tab.name === "order"
              ? newOrdersCount
              : tab.name === "message"
                ? newMessagesCount
                : 0;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => router.push(tab.href)}
              style={styles.item}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={
                indicatorCount > 0
                  ? `${tab.label}, ${indicatorCount} new`
                  : tab.label
              }
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={focused ? tab.icon : tab.outlineIcon}
                  size={23}
                  color={focused ? "#14532d" : "#6b7280"}
                />
                {seenMarkersLoaded && indicatorCount > 0 && (
                  <View style={styles.indicator}>
                    <Text style={styles.indicatorText}>
                      {indicatorCount > 9 ? "9+" : indicatorCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, focused && styles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const BAR_H = FARMER_TAB_BAR_HEIGHT;
const PAD_BOT = Platform.OS === "ios" ? 20 : 0;

const styles = StyleSheet.create({
  barWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BAR_H,
    pointerEvents: "box-none",
    backgroundColor: "#ffffff",
  },
  systemNavigationArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f3f4f6",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BAR_H,
    paddingBottom: PAD_BOT,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 16,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 3,
    paddingBottom: 5,
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  indicator: {
    position: "absolute",
    top: -3,
    right: -2,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    borderWidth: 1,
    borderColor: "#ffffff",
  },
  indicatorText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "700",
    lineHeight: 10,
  },
  label: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: "400",
  },
  labelActive: {
    color: "#14532d",
    fontWeight: "700",
  },
});

export default function Layout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="product" />
      <Tabs.Screen name="order" />
      <Tabs.Screen name="message" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
