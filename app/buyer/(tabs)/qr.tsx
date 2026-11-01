// Buyer QR scanner screen to open a farm shop.
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import {
  router,
} from "expo-router";

import {
  useRef,
  useState,
} from "react";

import {
  Linking,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppAlert } from "@/src/context/FarmerAlertContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

export default function QRScanner() {
  const Alert = useAppAlert();
  const insets = useSafeAreaInsets();

  // The camera needs permission before the scanner can start.
  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  // The camera reports the same code several times in a row, so this flag makes
  // sure only the first result is handled.
  const scanningRef =
    useRef(false);

  // Shown when camera access was refused.
  const [
    deniedModalVisible,
    setDeniedModalVisible,
  ] = useState(false);

  const [
    deniedCanAskAgain,
    setDeniedCanAskAgain,
  ] = useState(true);

  const openCameraSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      getUserFriendlyErrorMessage(error, "Open camera settings");
      Alert.alert(
        "Unable to Open Settings",
        "Please open your device settings and allow FarmGate to use the camera."
      );
    }
  };

const requestCameraAccess = async () => {
    try {
      const result = await requestPermission();
      if (result.granted) return;

      setDeniedCanAskAgain(result.canAskAgain);
      setDeniedModalVisible(true);
    } catch (error) {
      getUserFriendlyErrorMessage(error, "Request buyer camera permission");
      Alert.alert(
        "Camera Permission Error",
        "FarmGate couldn't request camera access. Please try again."
      );
    }
  };

  // Nothing to render until the permission state is known.
  if (!permission) {

    return (
      <View className="flex-1 bg-white" />
    );
  }

  // Replace the scanner with instructions while camera access is missing.
  if (!permission.granted) {

    return (
      <View className="flex-1" style={{ backgroundColor: "#fafafa" }}>
        <View
          className="rounded-b-2xl px-5 pb-5"
          style={{ backgroundColor: "#14532d", paddingTop: 56 }}
        >
          <Text className="text-white text-lg font-bold">Scan Farm QR</Text>
        </View>

        <View className="flex-1 justify-center px-6">
          <View className="items-center rounded-[10px] bg-white px-6 py-8">
            <View
              className="mb-5 h-20 w-20 items-center justify-center rounded-full"
              style={{ backgroundColor: "#f0fdf4" }}
            >
              <MaterialCommunityIcons
                name="camera-outline"
                size={38}
                color="#14532d"
              />
            </View>
            <Text className="text-center text-xl font-bold text-gray-900">
              Camera access needed
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-gray-600">
              Allow camera access to scan a farm QR code and open its shop.
            </Text>

            <View
              className="mt-4 w-full flex-row items-center rounded-[10px] px-4 py-3"
              style={{ backgroundColor: "#f0fdf4" }}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={20}
                color="#14532d"
              />
              <Text className="ml-3 flex-1 text-xs leading-4 text-gray-700">
                Point your camera at a farm QR to jump straight to its shop.
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={
                permission.canAskAgain
                  ? requestCameraAccess
                  : openCameraSettings
              }
              className="mt-5 w-full items-center rounded-[10px] px-5 py-3.5"
              style={{ backgroundColor: "#14532d" }}
            >
              <Text className="font-semibold text-white">
                {permission.canAskAgain ? "Allow Camera" : "Open Settings"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={deniedModalVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setDeniedModalVisible(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/60 px-8">
            <View
              className="w-full overflow-hidden rounded-[20px] bg-white"
              style={{
                elevation: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.3,
                shadowRadius: 24,
              }}
            >
              <View
                className="items-center px-6 pb-5 pt-6"
                style={{ backgroundColor: "#14532d" }}
              >
                <View
                  className="h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.16)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.35)",
                  }}
                >
                  <MaterialCommunityIcons
                    name="camera-off-outline"
                    size={30}
                    color="white"
                  />
                </View>
                <Text
                  className="mt-3 text-center text-[11px] font-bold tracking-widest"
                  style={{ color: "#bbf7d0" }}
                >
                  CAMERA ACCESS NEEDED
                </Text>
                <Text className="mt-1 text-center text-lg font-bold leading-6 text-white">
                  FarmGate Direct needs permission for accessing camera
                </Text>
              </View>

              <View className="px-6 py-5">
                <Text className="text-center text-sm leading-5 text-gray-600">
                  Camera access is required to scan a farm QR code and open its shop.
                </Text>

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    setDeniedModalVisible(false);
                    if (deniedCanAskAgain) {
                      requestCameraAccess();
                    } else {
                      openCameraSettings();
                    }
                  }}
                  className="mt-4 w-full flex-row items-center justify-center rounded-[10px] px-5 py-3.5"
                  style={{ backgroundColor: "#14532d" }}
                >
                  <MaterialCommunityIcons
                    name={deniedCanAskAgain ? "camera-outline" : "cog-outline"}
                    size={18}
                    color="white"
                  />
                  <Text className="ml-2 font-semibold text-white">
                    {deniedCanAskAgain ? "Allow Camera" : "Open Settings"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setDeniedModalVisible(false)}
                  className="mt-1 w-full items-center px-5 py-3"
                >
                  <Text className="font-semibold text-gray-500">
                    Not now
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Opens the farm shop of a scanned QR code.
  const handleScan = ({
    data,
  }: any) => {

    // The camera reports the same code several times in a row, so the first
    // result wins until the scanner is reset.
    if (scanningRef.current)
      return;

    scanningRef.current = true;

    // A farm code looks like client://farm/abc123.
    if (
      data.startsWith(
        "client://farm/"
      )
    ) {

      const farmerId =
        data.replace(
          "client://farm/",
          ""
        );

      router.push({
        pathname:
          "/buyer/farm/[farmerId]",

        params: {
          farmerId,
        },
      });

      // Allow the next scan after a short delay.
      setTimeout(() => {

        scanningRef.current =
          false;

      }, 2000);

      return;
    }

    Alert.alert(
      "Invalid QR Code",
      "This QR code is not supported.",
      [
        {
          text: "OK",

          onPress: () => {

            scanningRef.current =
              false;
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScan}
      />

      <View
        pointerEvents="box-none"
        className="absolute inset-0"
      >
        <View
          className="absolute left-0 right-0 px-6"
          style={{ top: insets.top + 16 }}
        >
          <View className="flex-row items-center">
            <View
              className="mr-3 h-11 w-11 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={23}
                color="white"
              />
            </View>
            <View>
              <Text className="text-xs font-semibold uppercase tracking-widest text-white/75">
                FarmGate
              </Text>
              <Text className="mt-0.5 text-xl font-bold text-white">
                Scan a farm QR
              </Text>
            </View>
          </View>
          <Text className="mt-4 text-sm leading-5 text-white/85">
            Find a farm and browse its fresh products.
          </Text>
        </View>

        <View
          pointerEvents="none"
          className="absolute left-0 right-0 items-center"
          style={{ top: "36%" }}
        >
          <View
            className="h-[270px] w-[270px] items-center justify-center rounded-[24px]"
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.45)",
              backgroundColor: "rgba(0,0,0,0.08)",
            }}
          >
            <View
              className="absolute left-0 top-0 h-9 w-9 rounded-tl-[24px]"
              style={{
                borderLeftWidth: 4,
                borderTopWidth: 4,
                borderColor: "#86efac",
              }}
            />
            <View
              className="absolute right-0 top-0 h-9 w-9 rounded-tr-[24px]"
              style={{
                borderRightWidth: 4,
                borderTopWidth: 4,
                borderColor: "#86efac",
              }}
            />
            <View
              className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-[24px]"
              style={{
                borderBottomWidth: 4,
                borderLeftWidth: 4,
                borderColor: "#86efac",
              }}
            />
            <View
              className="absolute bottom-0 right-0 h-9 w-9 rounded-br-[24px]"
              style={{
                borderBottomWidth: 4,
                borderRightWidth: 4,
                borderColor: "#86efac",
              }}
            />
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={32}
              color="rgba(255,255,255,0.78)"
            />
          </View>
          <Text className="mt-5 text-sm font-semibold text-white">
            Align the QR code inside the frame
          </Text>
        </View>

        <View
          pointerEvents="none"
          className="absolute left-5 right-5 flex-row items-center rounded-[10px] px-4 py-3.5"
          style={{
            bottom: 108 + insets.bottom,
            backgroundColor: "rgba(17,24,39,0.78)",
          }}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color="#bbf7d0"
          />
          <Text className="ml-3 flex-1 text-xs leading-5 text-white/90">
            Hold your phone steady and make sure the code is well lit.
          </Text>
        </View>
      </View>
    </View>
  );
}