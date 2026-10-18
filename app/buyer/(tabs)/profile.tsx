// Buyer profile menu screen.
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CommonActions } from "@react-navigation/native";
import { useRouter } from "expo-router";

import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../../../FirebaseConfig";

const Profile = () => {

  const router = useRouter();

  const [user, setUser] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [modalVisible, setModalVisible] =
    useState(false);

  // Load the logged in buyer profile data.
  useEffect(() => {

    const loadUser = async () => {

      try {

        const storedUser =
          await AsyncStorage.getItem(
            "user"
          );

        if (!storedUser) return;

        const parsedUser =
          JSON.parse(storedUser);

        const userId =
          parsedUser.uid ||
          parsedUser.userId ||
          parsedUser.id;

        const userDoc =
          await getDoc(
            doc(
              db,
              "users",
              userId
            )
          );

        if (!userDoc.exists()) {
          return;
        }

        setUser({
          id: userDoc.id,
          ...userDoc.data(),
        });

      } catch (error) {

        console.log(
          "LOAD USER ERROR:",
          error
        );

      } finally {

        setLoading(false);
      }
    };

    loadUser();

  }, []);

  // Clears the stored session and returns to the login screen.
  const handleLogout = async () => {
    try {
      setModalVisible(false);

      await AsyncStorage.removeItem("user");

      router.replace("/auth/login");

    } catch (error) {
      console.log(error);
    }
  };

  if (loading) {

    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator
          size="large"
          color="#14532d"
        />
      </View>
    );
  }

  const MENU_ITEMS = [
  { label: "My Account", icon: "account-outline", route: "/buyer/profile/account-setting" },
  { label: "My Cart", icon: "cart-outline", route: "/buyer/(tabs)/cart" },
  { label: "Address", icon: "map-marker-outline", route: "/buyer/profile/address" },
  { label: "My Orders", icon: "format-list-bulleted", route: "/buyer/profile/orders" },
  { label: "Saved Farms", icon: "heart-outline", route: "/buyer/profile/saved-farms" },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: "#14532d" }}>

      <View className="h-32 justify-center px-6">
      </View>

      <View className="flex-1 bg-white rounded-t-[40px] px-6 pt-20">

        <View className="items-center mb-8">

          <Text className="text-lg font-bold text-gray-800 mt-1">
            {user?.fullName || "User"}
          </Text>

        </View>

        <View>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              className={`w-full flex-row items-center justify-between py-4 ${
                index < MENU_ITEMS.length - 1 ? "border-b border-gray-100" : ""
              }`}
              onPress={() => router.push(item.route as any)}
            >
              <View className="flex-row items-center gap-3">
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={20}
                  color="#14532d"
                />
                <Text className="text-gray-800 font-semibold text-sm">
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
          className="w-full flex-row items-center justify-between py-4 border-t border-gray-100 mt-2"
          onPress={() =>
            setModalVisible(true)
          }
        >

          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons
              name="logout"
              size={20}
              color="#dc2626"
            />
            <Text className="text-red-600 font-semibold text-sm">
              Log out
            </Text>
          </View>

        </TouchableOpacity>

      </View>

      <View className="absolute top-20 self-center items-center">

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (user?.profileImage) {
              router.push({
                pathname: "/buyer/profile/view-profile",
                params: {
                  image: user.profileImage,
                },
              });
            }
          }}
        >

          <View className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-green-100 justify-center items-center">

            {user?.profileImage ? (

              <Image
                source={{
                  uri: user.profileImage,
                }}
                className="w-full h-full"
              />

            ) : (

              <MaterialCommunityIcons
                name="account"
                size={60}
                color="#14532d"
              />

            )}

          </View>

        </TouchableOpacity>

      </View>

      {modalVisible && (

        <View className="absolute inset-0 justify-center items-center bg-black/40">

          <View className="bg-white rounded-[5px] p-6 w-80">

            <Text className="text-gray-800 text-lg font-semibold mb-4">
              Are you sure you want to logout?
            </Text>

            <View className="flex-row justify-between mt-4">

              <TouchableOpacity
                className="bg-gray-200 px-4 py-2 rounded-[5px] flex-1 mr-2 items-center"
                onPress={() =>
                  setModalVisible(false)
                }
              >
                <Text className="text-gray-700 font-semibold">
                  Cancel
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                className="px-4 py-2 rounded-[5px] flex-1 ml-2 items-center"
                style={{ backgroundColor: "#dc2626" }}
                onPress={handleLogout}
              >
                <Text className="text-white font-semibold">
                  Logout
                </Text>

              </TouchableOpacity>

            </View>

          </View>

        </View>
      )}

    </View>
  );
};

export default Profile;