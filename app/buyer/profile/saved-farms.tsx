// Farms the buyer has saved, with an option to unsave them.
import React, { useCallback, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getSavedFarms, unsaveFarm } from "@/src/services/savedFarmService";
import { useToast } from "@/context/ToastContext";

const DARK_GREEN = "#14532d";

const SavedFarmsScreen = () => {
  const router = useRouter();
  const { showToast } = useToast();

  const [farms, setFarms] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadFarms();
    }, [])
  );

  const loadFarms = useCallback(async () => {
    try {
      const userStr = await AsyncStorage.getItem("user");

      if (!userStr) {
        console.log("No user found in AsyncStorage");
        return;
      }

      const user = JSON.parse(userStr);

      const userId = user.uid || user.userId || user.id;

      console.log("Loading saved farms for user:", userId);

      if (!userId) {
        console.log("No user ID found");
        return;
      }

      const data = await getSavedFarms(userId);

      console.log("Saved farms:", data);

      setFarms(data);
    } catch (error) {
      console.log("Error loading saved farms:", error);
    }
  }, []);

  const handleDelete = async () => {
    if (!selectedFarmerId) return;

    try {
      const userStr = await AsyncStorage.getItem("user");
      if (!userStr) {
        showToast("User not logged in");
        return;
      }

      const user = JSON.parse(userStr);

      await unsaveFarm(
        user.uid || user.userId || user.id,
        selectedFarmerId
      );

      setModalVisible(false);
      setSelectedFarmerId(null);

      await loadFarms();

      showToast("Farm removed from saved farms");
    } catch (error) {
      console.log(error);
      showToast("Failed to remove farm");
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#fafafa" }}>
      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-white font-bold text-lg">
          Saved Farms
        </Text>
      </View>

      <ScrollView
        className="px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
      >

        {farms.length === 0 ? (

          <View className="items-center py-16">
            <Ionicons name="heart-outline" size={48} color="#d1d5db" />
            <Text className="text-gray-400 font-semibold mt-3 text-sm">
              No saved farms yet
            </Text>
          </View>

        ) : (

          farms.map((farm) => (
            <TouchableOpacity
              key={farm.id}
              onPress={() =>
                router.push({
                  pathname: "/buyer/farm/[farmerId]",
                  params: { farmerId: farm.farmerId },
                })
              }
              activeOpacity={0.85}
              className="bg-white rounded-[10px] mb-4 overflow-hidden border border-gray-100"
            >

              <View style={{ height: 140 }} className="bg-green-50">
                {farm.coverPhoto ? (
                  <Image
                    source={{ uri: farm.coverPhoto }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="leaf-outline" size={32} color="#86efac" />
                  </View>
                )}
              </View>

              <View className="p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="font-bold text-base text-gray-900">
                      {farm.farmName}
                    </Text>

                    <View className="flex-row items-center gap-1 mt-1.5">
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={DARK_GREEN}
                      />
                      <Text className="text-gray-500 text-sm">
                        {farm.municipality}, {farm.province}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedFarmerId(farm.farmerId);
                      setModalVisible(true);
                    }}
                    className="flex-row items-center"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={14}
                      color="#dc2626"
                    />

                    <Text className="text-red-600 font-semibold text-xs ml-1.5">
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

            </TouchableOpacity>
          ))

        )}

      </ScrollView>
      {modalVisible && (
        <View className="absolute inset-0 justify-center items-center bg-black/40">
          <View
            className="bg-white rounded-[5px] p-6 w-80"
            style={{ borderWidth: 1, borderColor: "#14532d" }}
          >

            <Text className="text-gray-800 text-lg font-semibold mb-4">
              Are you sure you want to remove this farm?
            </Text>

            <Text className="text-gray-500 text-sm mb-2">
              This farm will be removed from your saved farms.
            </Text>

            <View className="flex-row justify-between mt-4">

              <TouchableOpacity
                className="bg-gray-200 px-4 py-2 rounded-[5px] flex-1 mr-2 items-center"
                onPress={() => {
                  setModalVisible(false);
                  setSelectedFarmerId(null);
                }}
              >
                <Text className="text-gray-700 font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="px-4 py-2 rounded-[5px] flex-1 ml-2 items-center"
                style={{ backgroundColor: "#dc2626" }}
                onPress={handleDelete}
              >
                <Text className="text-white font-semibold">
                  Remove
                </Text>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default SavedFarmsScreen;