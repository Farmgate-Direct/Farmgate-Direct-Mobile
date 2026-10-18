// Bottom tab layout for buyers. The QR scanner sits in the middle of the five
// tabs, so it gets its own raised button.
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, useSegments } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BuyerUnreadChatsProvider,
  useBuyerUnreadChats,
} from "../../../src/hooks/BuyerUnreadChats";

// Tab order: Home, Shop, QR, Message, Profile. Only the QR tab is marked center.
const TABS = [
  { name: "home",    icon: "home",              label: "Home",    center: false },
  { name: "shop",    icon: "bag",               label: "Shop",    center: false },
  { name: "qr",      icon: "qr-code",           label: "QR",      center: true  },
  { name: "message", icon: "chatbubble-ellipses", label: "Message", center: false },
  { name: "profile", icon: "person",            label: "Profile", center: false },
] as const;

// Draws the tab bar and puts a dot on Message when a chat is unread.
function CustomTabBar() {
  const router   = useRouter();
  const segments = useSegments();
  const active   = segments[segments.length - 1] ?? "home";
  const { unreadChatIds } = useBuyerUnreadChats();

  return (
    <View style={styles.barWrapper}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const focused = active === tab.name;

          if (tab.center) {
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => router.push(`/buyer/(tabs)/${tab.name}` as any)}
                style={styles.centerItem}
                activeOpacity={0.8}
              >
                <View style={[styles.scanCircle, focused && styles.scanCircleActive]}>
                  <Ionicons
                    name="qr-code"
                    size={26}
                    color="#14532d"
                  />
                </View>
                <Text style={[styles.label, focused ? styles.labelActive : styles.labelCenter]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => router.push(`/buyer/${tab.name}` as any)}
              style={styles.item}
              activeOpacity={0.75}
            >
              <View>
                <Ionicons
                  name={(focused ? tab.icon : `${tab.icon}-outline`) as any}
                  size={23}
                  color={focused ? "#14532d" : "#9ca3af"}
                />
                {tab.name === "message" && unreadChatIds.size > 0 && (
                  <View style={styles.unreadTabDot} />
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

// The bar is taller on iOS because of the home indicator, and the QR circle is
// lifted above the bar.
const BAR_H   = Platform.OS === "ios" ? 80 : 64;
const PAD_BOT = Platform.OS === "ios" ? 20 : 0;
const CIRCLE  = 58;
const LIFT    = 20;

const styles = StyleSheet.create({
  barWrapper: {
    position:      "absolute",
    bottom:        0,
    left:          0,
    right:         0,
    height:        BAR_H + LIFT,
    pointerEvents: "box-none",
  },
  bar: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    height:          BAR_H,
    paddingBottom:   PAD_BOT,
    backgroundColor: "#ffffff",
    borderTopWidth:  1,
    borderTopColor:  "#e5e7eb",
    flexDirection:   "row",
    alignItems:      "center",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.07,
    shadowRadius:    8,
    elevation:       16,
  },
  item: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            4,
    paddingTop:     3,
    paddingBottom:  5,
  },
  centerItem: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "flex-end",
    paddingBottom:  PAD_BOT > 0 ? PAD_BOT - 4 : 6,
    gap:            4,
    overflow:       "visible",
  },
  scanCircle: {
    width:           CIRCLE,
    height:          CIRCLE,
    borderRadius:    CIRCLE / 2,
    backgroundColor: "#ffffff",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    LIFT - 20,
    borderWidth:     3,
    borderColor:     "#14532d",
  },
  scanCircleActive: {
    backgroundColor: "#f0fdf4",
  },
  label: {
    fontSize:   10,
    color:      "#9ca3af",
    fontWeight: "400",
  },
  labelActive: {
    color:      "#14532d",
    fontWeight: "700",
  },
  labelCenter: {
    color:      "#14532d",
    fontWeight: "600",
  },
  unreadTabDot: {
    position: "absolute",
    top: -1,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#dc2626",
    borderWidth: 1,
    borderColor: "#ffffff",
  },
});

// The unread chats provider wraps the tabs so the dot can read the chat count.
export default function Layout() {
  return (
    <BuyerUnreadChatsProvider>
      <Tabs
        tabBar={() => <CustomTabBar />}
        screenOptions={{
          headerShown:          false,
          tabBarHideOnKeyboard:  true,
        }}
      >
        <Tabs.Screen name="home"    />
        <Tabs.Screen name="shop"    />
        <Tabs.Screen name="qr"      />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="message" />
      </Tabs>
    </BuyerUnreadChatsProvider>
  );
}