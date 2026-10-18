// Form for adding a new buyer address, including the default toggle.
import { MaterialCommunityIcons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Dropdown } from "react-native-element-dropdown";

import {
  addAddress,
} from "@/src/services/addressService";

import { useToast } from "../../../context/ToastContext";

import { sanitizePhoneInput } from "../../../utils/validators";

import {
  BULACAN_PROVINCE,
  BULACAN_CITIES,
  barangaysForCity,
  postalCodeForCity,
} from "@/constants/bulacanBarangays";

// The province is locked to Bulacan. The City and Barangay dropdowns use the
// local dataset, so their names match the backend exactly, with no fuzzy match.
const LOCKED_REGION = "Central Luzon (Region III)";

const NewAddress = () => {

  const router =
    useRouter();

  const { showToast } = useToast();

  const [loading, setLoading] =
    useState(false);

  // The city and barangay lists are local, so there is no network wait.
  const locationLoading = false;

  const [fullName, setFullName] =
    useState("");

  // Only the 10 digits after +63 are stored, the same as on the register form.
  const [phone, setPhone] =
    useState("");

  const [street, setStreet] =
    useState("");

  // The name and number are filled in from the registered account so the buyer
  // does not have to type them again.
  useEffect(() => {
    (async () => {
      try {
        const userStr =
          await AsyncStorage.getItem("user");
        if (!userStr) return;
        const stored = JSON.parse(userStr);
        if (!fullName && stored?.fullName) {
          setFullName(String(stored.fullName));
        }
        if (stored?.phone) {
          setPhone(sanitizePhoneInput(String(stored.phone)));
        }
      } catch {
        // Nothing is filled in when there is no stored session.
      }
    })();
    // Only runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isDefault, setIsDefault] =
    useState(false);

  // The region and province cannot be changed.
  const selectedRegion = { name: LOCKED_REGION };
  const selectedProvince = { name: BULACAN_PROVINCE };

  // City and barangay dropdowns, filled from the local dataset.
  const cities = BULACAN_CITIES.map((name) => ({ name, code: name }));

  const [selectedCity, setSelectedCity] =
    useState<any>(null);

  const [selectedBarangay, setSelectedBarangay] =
    useState<any>(null);

  const barangays = selectedCity
    ? barangaysForCity(selectedCity.name).map((name) => ({ name, code: name }))
    : [];

  // The postal code is worked out from the city, so there is nothing to type.
  const autoPostalCode = selectedCity
    ? postalCodeForCity(selectedCity.name)
    : "";

  const validatePhone =
    (number: string) => {

      const regex =
        /^(09\d{9}|\+639\d{9})$/;

      return regex.test(number);
    };

  // The 10 digits are stored without a prefix, so the 09 is added back for
  // validation and storage.
  const fullPhoneNumber = `0${phone}`;

  const handleSubmit =
    async () => {

      try {

        if (
          !selectedRegion ||
          !selectedProvince
        ) {

          showToast("Location is still loading. Please wait.");

          return;
        }

        if (
          !fullName.trim() ||
          !phone.trim() ||
          !selectedCity ||
          !selectedBarangay ||
          !street.trim()
        ) {

          showToast("Please fill all fields");

          return;
        }

        if (
          !validatePhone(
            fullPhoneNumber
          )
        ) {

          showToast("Enter a valid Philippine mobile number.");

          return;
        }

        if (!autoPostalCode) {
          showToast("Please select a valid city / municipality.");
          return;
        }

        setLoading(true);

        const userStr =
          await AsyncStorage.getItem(
            "user"
          );

        const user =
          userStr
            ? JSON.parse(userStr)
            : null;

        if (!user) {

          showToast("User session not found.");

          return;
        }

        await addAddress({

          userId:
            user.uid ||
            user.userId ||
            user.id,

          fullName:
            fullName.trim(),

          phone:
            fullPhoneNumber,

          // Region and province are always Bulacan.
          region:
            selectedRegion.name,

          province:
            selectedProvince.name,

          city:
            selectedCity.name,

          barangay:
            selectedBarangay.name,

          postalCode:
            autoPostalCode,

          street:
            street.trim(),

          isDefault,

        });

        router.back();
        showToast("Address added successfully.");

      } catch (error) {

        console.log(
          "Save address error:",
          error
        );

        showToast("Failed to save address.");

      } finally {

        setLoading(false);

      }
    };

  if (locationLoading) {

    return (

      <View className="flex-1 bg-white">

        <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">

          <TouchableOpacity
            onPress={() =>
              router.back()
            }
          >

            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="white"
            />

          </TouchableOpacity>

          <Text className="text-white font-bold text-lg ml-4">
            New Address
          </Text>

        </View>

        <View className="flex-1 justify-center items-center">

          <ActivityIndicator
            size="large"
            color="#14532d"
          />

          <Text className="text-gray-500 mt-4">
            Loading Bulacan locations...
          </Text>

        </View>

      </View>
    );
  }

  return (

    <View className="flex-1 bg-white">


      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
        >

          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="white"
          />

        </TouchableOpacity>

        <Text className="text-white font-bold text-lg ml-4">
          New Address
        </Text>

      </View>


      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

      <Text className="text-gray-500 text-xs mb-1 ml-1">Full Name</Text>
      <TextInput
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
        className="bg-gray-100 rounded-[5px] px-4 py-4 mb-4"
      />

      {/* Phone field uses the same +63 with 10 digits layout as the register form. */}
      <Text className="text-gray-500 text-xs mb-1 ml-1">Phone Number</Text>
      <View className="flex-row items-center bg-gray-100 rounded-[5px] mb-4 overflow-hidden">
        <View className="px-4 self-stretch justify-center border-r border-gray-200">
          <Text className="text-gray-700 font-semibold">+63</Text>
        </View>
        <TextInput
          placeholder="9XX XXX XXXX"
          placeholderTextColor="#9ca3af"
          value={phone}
          onChangeText={(value) => setPhone(sanitizePhoneInput(value))}
          keyboardType="phone-pad"
          maxLength={10}
          className="flex-1 px-4 py-4 text-gray-800"
        />
      </View>

      <Text className="text-gray-500 text-xs mb-1 ml-1">Region</Text>
      <View className="bg-gray-100 rounded-[5px] px-4 py-4 mb-4">
        <Text className="text-gray-800 text-base font-medium">
          {selectedRegion?.name}
        </Text>
      </View>

      <Text className="text-gray-500 text-xs mb-1 ml-1">Province</Text>
      <View className="bg-gray-100 rounded-[5px] px-4 py-4 mb-4">
        <Text className="text-gray-800 text-base font-medium">
          {selectedProvince?.name}
        </Text>
      </View>

      <Text className="text-gray-500 text-xs mb-1 ml-1">City / Municipality</Text>
      <Dropdown
        style={{
          backgroundColor: "#F3F4F6",
          borderRadius: 5,
          paddingHorizontal: 16,
          height: 50,
          marginBottom: 16,
        }}
        data={cities}
        labelField="name"
        valueField="code"
        placeholder="Select City / Municipality"
        search
        searchPlaceholder="Search city or municipality..."
        value={selectedCity?.code}
        activeColor="#f0fdf4"
        onChange={(item) => {
          setSelectedCity(item);
          setSelectedBarangay(null);
        }}
      />

      <Text className="text-gray-500 text-xs mb-1 ml-1">Barangay</Text>
      <Dropdown
        disable={!selectedCity}
        style={{
          backgroundColor: "#F3F4F6",
          borderRadius: 5,
          paddingHorizontal: 16,
          height: 50,
          marginBottom: 16,
          opacity: selectedCity ? 1 : 0.5,
        }}
        data={barangays}
        labelField="name"
        valueField="code"
        placeholder="Select Barangay"
        search
        searchPlaceholder="Search barangay..."
        value={selectedBarangay?.code}
        activeColor="#f0fdf4"
        onChange={(item) => {
          setSelectedBarangay(item);
        }}
      />

      {/* Filled in from the selected city and not editable. */}
      <Text className="text-gray-500 text-xs mb-1 ml-1">Postal Code</Text>
      <View className="bg-gray-100 rounded-[5px] px-4 py-4 mb-1">
        <Text className={`text-base ${autoPostalCode ? "text-gray-800 font-medium" : "text-gray-400"}`}>
          {autoPostalCode || "Select city first"}
        </Text>
      </View>
      <Text className="text-gray-400 text-[11px] mb-4 ml-1">
        Automatic based on city / municipality
      </Text>

      <Text className="text-gray-500 text-xs mb-1 ml-1">House No. / Street</Text>
      <TextInput
        placeholder="House No. / Street"
        value={street}
        onChangeText={setStreet}
        className="bg-gray-100 rounded-[5px] px-4 py-4 mb-6"
      />


        <View className="flex-row justify-between items-center mb-8 py-2 border-t border-gray-100 pt-6">

          <Text className="text-gray-700 font-medium text-sm">
            Set as Default
          </Text>

          <Switch
            value={isDefault}
            onValueChange={
              setIsDefault
            }
            trackColor={{
              false: "#d1d5db",
              true: "#14532d",
            }}
            thumbColor={
              isDefault
                ? "#ffffff"
                : "#f4f4f5"
            }
          />

        </View>


        <TouchableOpacity
          activeOpacity={0.8}
          disabled={loading}
          onPress={handleSubmit}
          className="rounded-[5px] py-4 items-center"
          style={{
            backgroundColor: loading ? "#9ca3af" : "#14532d",
            elevation: loading ? 0 : 4,
            shadowColor: "#14532d",
            shadowOpacity: 0.25,
            shadowRadius: 8,
          }}
        >

          {loading ? (

            <ActivityIndicator
              color="white"
            />

          ) : (

            <Text className="text-white font-bold text-base">
              Save Address
            </Text>

          )}

        </TouchableOpacity>

      </ScrollView>

    </View>
  );
};

export default NewAddress;