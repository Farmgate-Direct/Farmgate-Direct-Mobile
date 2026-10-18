// Buyer notification inbox route.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BuyerNotif,
  useBuyerNotifications,
} from "../../../src/hooks/UseBuyerNotification";
import {
  groupNotificationsByDay,
  timeAgo,
  toMillis,
} from "../../../src/services/notificationService";

const kindIcon = (kind: string): { name: any; bg: string; color: string } => {
  switch (kind) {
    case "order":
      return { name: "bag-handle-outline", bg: "#DCFCE7", color: "#14532D" };
    case "message":
      return { name: "chatbubble-ellipses-outline", bg: "#DBEAFE", color: "#1D4ED8" };
    case "payment":
      return { name: "checkmark-circle", bg: "#FEF3C7", color: "#B45309" };
    default:
      return { name: "information-circle", bg: "#F3F4F6", color: "#6B7280" };
  }
};

export default function BuyerNotifications() {
  const { items, loading, lastSeen, seenLoaded, markSeen } =
    useBuyerNotifications();
  const [refreshing, setRefreshing] = useState(false);

  // The last-seen marker is read once when the page opens, and it is what the
  // red dot is based on, so individual notifications stay visible as new even
  // after they were marked seen.
  const baselineRef = useRef<number | null>(null);
  if (seenLoaded && baselineRef.current === null) {
    baselineRef.current = lastSeen;
  }
  const baseline = baselineRef.current ?? Number.MAX_SAFE_INTEGER;

  // Everything on screen has now been seen, including anything that arrived while
  // the page was open, so the marker moves forward.
  useEffect(() => {
    if (seenLoaded) markSeen();
  }, [seenLoaded, items, markSeen]);

// Group notifications by day for the list.
  const groups = useMemo(() => groupNotificationsByDay(items as any), [items]);

// Open chat or order details from a notification.
  const handlePress = (n: BuyerNotif) => {
    if (n.kind === "message") {
      if (!n.farmerId) return;
      router.push({
        pathname: "/buyer/messages/ChatScreen",
        params: {
          farmerId: n.farmerId,
          farmerName: n.farmerName || "Farmer",
          farmerProfileImage: n.farmerProfileImage || "",
        },
      } as any);
      return;
    }
    if (n.orderId) {
      router.push({
        pathname: "/buyer/profile/order-details",
        params: { orderId: n.orderId },
      } as any);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#14532D" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F6F6F6]">
      {/* Header */}
      <View className="bg-[#14532D] px-5 pt-14 pb-4 flex-row items-center border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={22} color="#ffff" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[17px] font-semibold text-white -ml-6">
          Notifications
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/buyer/notifications/settings" as any)}
          className="p-1"
        >
          <Ionicons name="settings-outline" size={22} color="#ffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 800);
            }}
          />
        }
      >
        {items.length === 0 ? (
          <View className="items-center mt-16">
            <Ionicons name="notifications-off-outline" size={56} color="#D1D5DB" />
            <Text className="text-gray-400 mt-4">No notifications yet.</Text>
          </View>
        ) : (
          groups.map((g: any, index: number) => (
            <View
              key={g.label}
              className={
                index === 0 ? "" : g.label === "Earlier" ? "mt-2" : "mt-5"
              }
            >
              {g.label !== "Earlier" && g.label !== "Today" && (
                <View className="flex-row justify-between items-center mb-2 px-1">
                  <Text className="font-bold text-gray-900 text-[15px]">{g.label}</Text>
                </View>
              )}
              <View className="px-1">
                {g.data.map((item: any) => {
                  const n = item as BuyerNotif;
                  const icon = kindIcon(n.kind);
                  const isNew = toMillis(n.createdAt) > baseline;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      onPress={() => handlePress(n)}
                      className="flex-row items-center py-3"
                      activeOpacity={0.7}
                    >
                      <View
                        className="w-9 h-9 rounded-full items-center justify-center"
                        style={{ backgroundColor: icon.bg }}
                      >
                        <Ionicons name={icon.name} size={18} color={icon.color} />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text
                          className={`text-[13.5px] ${isNew ? "font-bold text-gray-900" : "text-gray-700"}`}
                          numberOfLines={2}
                        >
                          {n.body || n.title}
                        </Text>
                        <Text className="text-gray-400 text-[11px] mt-0.5">
                          {timeAgo(n.createdAt)}
                        </Text>
                      </View>
                      {isNew && (
                        <View className="w-2.5 h-2.5 rounded-full bg-red-500 ml-2" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}