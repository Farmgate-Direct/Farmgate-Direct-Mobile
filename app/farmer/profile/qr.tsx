// QR code that opens the farmer's public farm page when scanned.

import { Ionicons } from "@expo/vector-icons";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import React, {
  useRef,
  useState,
} from "react";

import {
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useToast } from "@/src/context/ToastContext";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

import QRCode from "react-native-qrcode-svg";

import ViewShot from "react-native-view-shot";

import * as MediaLibrary from "expo-media-library";

const QR = () => {
  const { showToast } = useToast();

  const { uid } =
    useLocalSearchParams();

  const [
    modalVisible,
    setModalVisible,
  ] = useState(false);

  const qrRef =
    useRef<any>(null);

  // Saves the farm QR code as an image in the phone gallery.
  const handleDownload =
    async () => {

      try {

        const permission =
         await MediaLibrary.requestPermissionsAsync(true);

        if (
          !permission.granted
        ) {

          showToast("Permission denied. Allow gallery access first.");

          return;
        }

        // Capture the QR view as an image.
        const uri =
          await qrRef.current.capture();

        await MediaLibrary.saveToLibraryAsync(
          uri
        );

        showToast("QR Code saved to gallery.");

      } catch (error) {
        showToast(
          getUserFriendlyErrorMessage(
            error,
            "Save farmer QR code",
            "We couldn't save your QR code. Please check your gallery access and try again."
          )
        );
      }
    };

  return (

    <View className="flex-1 bg-[#f5f5f5]">

      <View className="flex-row items-center px-5 pb-4 pt-14" style={{ backgroundColor: "#14532d" }}>

        <View className="flex-row items-center">

          <TouchableOpacity
            onPress={() =>
              router.back()
            }
            className="h-10 w-10 items-center justify-center"
          >

            <Ionicons
              name="arrow-back"
              size={24}
              color="white"
            />

          </TouchableOpacity>

          <Text className="ml-4 text-lg font-bold text-white">

            QR Code

          </Text>

        </View>

        <TouchableOpacity
          onPress={() =>
            setModalVisible(true)
          }
          accessibilityRole="button"
          accessibilityLabel="How to use QR code"
          className="h-10 w-10 items-center justify-center"
        >

          <Ionicons
            name="help-circle-outline"
            size={24}
            color="white"
          />

        </TouchableOpacity>

      </View>

      <View className="flex-1 items-center justify-center px-5 py-6">
        <View
          className="w-full items-center rounded-[10px] border border-gray-100 bg-white px-5 py-6"
          style={{ transform: [{ translateY: -28 }] }}
        >
          <Text className="mb-2 text-lg font-bold text-gray-900">
            Your Farm QR Code
          </Text>
          <Text className="mb-5 text-center text-sm text-gray-500">
            Buyers can scan this code to view your farm profile.
          </Text>

        <ViewShot
          ref={qrRef}
          options={{
            format: "png",
            quality: 1,
          }}
        >

          <View className="rounded-[10px] border border-gray-200 bg-white p-4">

            <QRCode
              value={`client://farm/${uid}`}
              size={220}
            />

          </View>

        </ViewShot>

        <TouchableOpacity
          onPress={handleDownload}
          className="mt-6 w-full flex-row items-center justify-center rounded-[10px] px-5 py-3.5"
          style={{ backgroundColor: "#14532d" }}
        >

          <Ionicons name="download-outline" size={19} color="white" />
          <Text className="ml-2 font-semibold text-white">

            Download

          </Text>

        </TouchableOpacity>
        </View>

      </View>

      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >

        <View className="flex-1 items-center justify-center bg-black/40 px-6">

          <View className="w-full rounded-[10px] bg-white p-6">

            <Text className="mb-4 text-lg font-bold text-gray-900">

              How to Use QR Code

            </Text>

            <Text className="mb-2 text-sm text-gray-600">

              1. Tap Download button.

            </Text>

            <Text className="mb-2 text-sm text-gray-600">

              2. Save QR code to your device.

            </Text>

            <Text className="mb-2 text-sm text-gray-600">

              3. Print the QR code.

            </Text>

            <Text className="mb-5 text-sm text-gray-600">

              4. Place it at your farm
              gate or selling area so
              buyers can scan it.

            </Text>

            <TouchableOpacity
              onPress={() =>
                setModalVisible(false)
              }
              className="rounded-[10px] py-3.5"
              style={{ backgroundColor: "#14532d" }}
            >

              <Text className="text-white text-center font-semibold">

                Close

              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

    </View>
  );
};

export default QR;