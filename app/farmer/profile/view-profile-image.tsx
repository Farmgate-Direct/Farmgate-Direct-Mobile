// Full screen view of a farmer's profile image.
import { Ionicons } from "@expo/vector-icons";

import { useLocalSearchParams, useRouter } from "expo-router";

import React from "react";

import {
  Image,
  TouchableOpacity,
  View,
} from "react-native";

const ViewProfile = () => {

  const router = useRouter();

  const { image } =
    useLocalSearchParams();

  return (

    <View className="flex-1 bg-black justify-center items-center">

      <TouchableOpacity
        className="absolute top-14 left-6 z-10"
        onPress={() => router.back()}
      >

        <Ionicons
          name="arrow-back"
          size={28}
          color="white"
        />

      </TouchableOpacity>

      <Image
        source={{
          uri: image as string,
        }}
        resizeMode="contain"
        className="w-full h-full"
      />

    </View>
  );
};

export default ViewProfile;