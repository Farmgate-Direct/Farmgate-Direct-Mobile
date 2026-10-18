// Confirmation screen the verification email link opens.
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";

export default function EmailVerified() {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12" style={{ backgroundColor: "#f5f5f5" }}>
      <View
        className="w-full max-w-md items-center rounded-[10px] bg-white px-7 py-10"
        style={{ borderWidth: 1, borderColor: "#e5e7eb" }}
      >
        <Image
          source={require("../../assets/Farmgate-logos/farmgate-logo.png")}
          style={{ width: 96, height: 96 }}
          resizeMode="contain"
          accessibilityLabel="FarmGate Direct logo"
        />
        <View
          className="mt-6 h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: "#f0fdf4" }}
        >
          <MaterialCommunityIcons name="check-circle" size={38} color="#14532d" />
        </View>
        <Text className="mt-5 text-center text-2xl font-bold" style={{ color: "#14532d" }}>
          Email verified
        </Text>
        <Text className="mt-3 text-center text-base leading-6 text-gray-600">
          Your FarmGate account email is confirmed.
        </Text>
        <Text className="mt-2 text-center text-sm leading-5 text-gray-500">
          Return to the FarmGate app and tap “I’ve verified my email” to continue your registration.
        </Text>
      </View>
      <Text className="mt-6 text-sm font-semibold tracking-wide" style={{ color: "#14532d" }}>
        FARMGATE DIRECT
      </Text>
    </View>
  );
}
