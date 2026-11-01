// Welcome screen shown first, leading to the login screen.
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  ImageBackground,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Renders the cover photo and sends the user to login when Get Started is tapped.
const Index = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-green-700">
      <ImageBackground
        className="flex-1 justify-end"
        resizeMode="cover"
         source={require("../assets/Farmgate-logos/starting-page.jpg")}
      >
        <View
          className="bg-white rounded-t-[30px] px-5 pt-10 pb-6 items-center"
          style={{ paddingBottom: 24 + insets.bottom }}
        >
          <Image
            className="w-14 h-14 mb-3"
            resizeMode="contain"
             source={require("../assets/Farmgate-logos/farmgate-logo.png")}
          />

          <Text className="text-black-700 text-[30px] font-bold mb-2">
            FARMGATE DIRECT
          </Text>

          <Text className="text-center text-[#000000] text-[15px] mb-7 px-4">
            From the hands of farmers to the homes of buyers.
          </Text>

          <TouchableOpacity
            className="w-full items-center justify-center py-3.5 rounded-[5px]"
            style={{ backgroundColor: "#14532d" }}
            onPress={() => router.push("/auth/login")}
          >
            <Text className="text-white font-bold text-lg">Get Started</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </View>
  );
};

export default Index;