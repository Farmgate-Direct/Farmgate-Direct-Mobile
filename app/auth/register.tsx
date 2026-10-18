// First step of registration: pick between the buyer and farmer forms.
import React from "react";
import { View, Text, TouchableOpacity, StatusBar, Image, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const Register = () => {
  const router = useRouter();

  return (
    <View className="flex-1" style={{ backgroundColor: "#14532d" }}>
      <StatusBar barStyle="light-content" backgroundColor="#14532d" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View className="items-center justify-center px-6 py-32">
        <Image
          source={require("../../assets/Farmgate-logos/farmgate-logo.png")}
          className="w-20 h-20 mb-3"
          resizeMode="contain"
        />
        <Text className="text-white text-2xl font-bold tracking-wide">
          FARMGATE DIRECT
        </Text>
        <Text className="text-green-100 text-sm mt-2 text-center">
          From the hands of farmers to the homes of buyers.
        </Text>
      </View>

      <View
        className="flex-1 bg-white rounded-t-[30px] px-5 pt-5 -mt-5"
        style={{ flexGrow: 1 }}
      >
        <View className="pt-5">
            <Text className="text-2xl font-bold text-gray-900 text-center">
              Register As
            </Text>
            <Text className="text-sm text-gray-500 text-center mt-2 mb-6">
              Choose how you would like to use FarmGate.
            </Text>

            <TouchableOpacity
              className="mb-4 w-full flex-row items-center rounded-[10px] border border-gray-200 bg-white p-4"
              activeOpacity={0.8}
              onPress={() => router.push("./register-buyer")}
            >
              <MaterialCommunityIcons name="cart-outline" size={32} color="#14532d" />
              <View className="flex-1 ml-4">
                <Text className="font-semibold text-base text-gray-800">Buyer</Text>
                <Text className="text-sm text-gray-500 mt-1">Find and purchase fresh produce</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              className="w-full flex-row items-center rounded-[10px] border border-gray-200 bg-white p-4"
              activeOpacity={0.8}
              onPress={() => router.push("./register-farmer")}
            >
              <MaterialCommunityIcons name="tractor-variant" size={32} color="#14532d" />
              <View className="flex-1 ml-4">
                <Text className="font-semibold text-base text-gray-800">Farmer</Text>
                <Text className="text-sm text-gray-500 mt-1">List your farm and sell produce</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#9ca3af" />
            </TouchableOpacity>

            <Text className="text-center text-gray-500 mt-6">
              Already have an account?{" "}
              <Text
                className="font-semibold"
                style={{ color: "#14532d" }}
                onPress={() => router.push("./login")}
              >
                Sign in
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default Register;
