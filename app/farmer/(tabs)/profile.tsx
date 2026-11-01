// Farmer profile menu screen.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";

import {
  ActivityIndicator,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../../../FirebaseConfig";
import { UserType } from "../../../src/types/user";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

// Main profile screen component.
const Profile = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [])
  );

// Reads the farmer profile from Firestore.
  const loadProfile = async () => {
    try {

      //setLoading(true);
      const storedUser = await AsyncStorage.getItem("user");

      if (!storedUser) return;

      const parsedUser = JSON.parse(storedUser);
      const userRef = doc(
        db,
        "users",
        parsedUser.uid
      );

      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as UserType;
        setUser(userData);
      }

    } catch (error) {
      getUserFriendlyErrorMessage(error, "Load farmer profile");
    } finally {
      setLoading(false);
    }
  };

// Clears the stored session and returns to the login screen.
  const handleLogout = async () => {
    try {
      setModalVisible(false);
      await AsyncStorage.removeItem("user");
      router.replace("/auth/login");
    } catch (error) {
      getUserFriendlyErrorMessage(error, "Sign out farmer");
    }
  };

if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator
          size="large"
          color="#14532d"
        />
      </View>
    );
  }

  const menuItems = [
    { label: "My Account", icon: "account-outline", route: "/farmer/profile/account-setting" },
    { label: "Farm Profile", icon: "sprout-outline", route: "/farmer/profile/edit-profile-farm" },
    { label: "Balance", icon: "wallet-outline", route: "/farmer/profile/balance" },
    { label: "Sales Report", icon: "file-chart-outline", route: "/farmer/profile/sales-report" },
    { label: "QR Code", icon: "qrcode", route: "/farmer/profile/qr" },
  ] as const;

  return (
    <View className="flex-1" style={{ backgroundColor: "#14532d" }}>
      <View className="h-32 justify-center px-6" />

      <View className="flex-1 rounded-t-[40px] bg-white px-6 pt-20">
        <View className="mb-8 items-center">
          <Text className="mt-1 text-lg font-bold text-gray-800">
            {user?.fullName || "Farmer"}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Text className="text-sm text-gray-500">Registered Farmer</Text>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color="#16a34a"
              style={{ marginLeft: 4 }}
            />
          </View>
        </View>

        <View>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              className={`w-full flex-row items-center justify-between py-4 ${
                index < menuItems.length - 1 ? "border-b border-gray-100" : ""
              }`}
              onPress={() => router.push({
                pathname: item.route,
                params: item.route === "/farmer/profile/qr" ? { uid: user?.uid } : undefined,
              })}
            >
              <View className="flex-row items-center gap-3">
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color="#14532d"
                />
                <Text className="text-sm font-semibold text-gray-800">
                  {item.label}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color="#9ca3af"
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          className="mt-2 w-full flex-row items-center justify-between border-t border-gray-100 py-4"
          onPress={() => setModalVisible(true)}
        >
          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons name="logout" size={20} color="#dc2626" />
            <View className="items-start">
              <Text className="text-sm font-semibold text-red-600">Log out</Text>
              <Text className="text-[10px] text-red-500">(Mag-log out)</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View className="absolute top-20 self-center items-center">
        <View className="h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-green-100">
          {user?.profileImage ? (
            <Image
              source={{ uri: user.profileImage }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <MaterialCommunityIcons name="account" size={60} color="#14532d" />
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.push("/farmer/profile/account-setting")}
          className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white"
          style={{ backgroundColor: "#14532d" }}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <MaterialCommunityIcons name="camera" size={18} color="white" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40">
          <View className="w-80 rounded-[5px] bg-white p-6">
            <Text className="mb-4 text-lg font-semibold text-gray-800">
              Are you sure you want to log out?
            </Text>
            <View className="mt-4 flex-row justify-between">
              <TouchableOpacity
                className="mr-2 flex-1 items-center rounded-[5px] bg-gray-200 px-4 py-2"
                onPress={() => setModalVisible(false)}
              >
                <View className="items-center justify-center">
                  <Text className="font-semibold text-gray-700">Cancel</Text>
                  <Text className="text-[10px] text-gray-500">(Kanselahin)</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className="ml-2 flex-1 items-center rounded-[5px] px-4 py-2"
                style={{ backgroundColor: "#dc2626" }}
                onPress={handleLogout}
              >
                <View className="items-center justify-center">
                  <Text className="font-semibold text-white">Log out</Text>
                  <Text className="text-[10px] text-white/80">(Mag-log out)</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Profile;