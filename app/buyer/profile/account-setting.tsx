// Buyer account settings: profile photo, name, and password changes.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { doc, updateDoc } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  getAuth,
} from "firebase/auth";
import { db } from "../../../FirebaseConfig";
import { uploadProfileImageAsync } from "@/src/services/cloudinaryProfileService";
import { deleteCloudinaryImage } from "../../../src/services/deleteImageService";
import { useToast } from "@/src/context/ToastContext";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

const AccountSetting = () => {
  const router = useRouter();
  const auth = getAuth();
  const { showToast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Reads the stored profile on mount.
  useEffect(() => {
    const loadUser = async () => {
      const userStr = await AsyncStorage.getItem("user");
      if (!userStr) return;
      setUser(JSON.parse(userStr));
    };

    loadUser();
  }, []);

  // Lets the buyer pick, crop, and upload a new profile photo.
  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        showToast("Please allow gallery access");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled) return;

      setLoading(true);

      const uploaded = await uploadProfileImageAsync(result.assets[0].uri);

      const userId = user.uid || user.userId || user.id;

      // Remove the previous photo so it does not stay in Cloudinary forever.
      if (user?.profileImagePublicId) {
        await deleteCloudinaryImage(user.profileImagePublicId);
      }

      await updateDoc(doc(db, "users", userId), {
        profileImage: uploaded.imageUrl,
        profileImagePublicId: uploaded.publicId,
      });

      // Keep the copy in local storage in sync with Firestore.
      const updatedUser = {
        ...user,
        profileImage: uploaded.imageUrl,
        profileImagePublicId: uploaded.publicId,
      };

      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

      setUser(updatedUser);

      showToast("Profile updated");
    } catch (error) {
      showToast(
        getUserFriendlyErrorMessage(
          error,
          "Upload buyer profile photo",
          "We couldn't update your photo. Please try another image or try again later."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setCurrentPasswordError("");
      setNewPasswordError("");

      if (!currentPassword || !newPassword) {
        if (!currentPassword) {
          setCurrentPasswordError("Enter your current password.");
        }
        if (!newPassword) {
          setNewPasswordError("Enter a new password.");
        }
        return;
      }
      if (currentPassword === newPassword) {
        setNewPasswordError("New password must be different from your current password.");
        return;
      }

      if (newPassword.length < 6) {
        setNewPasswordError("Password must be at least 6 characters.");
        return;
      }

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        showToast("User not found");
        return;
      }

      setSavingPassword(true);

      const credential = EmailAuthProvider.credential(
        firebaseUser.email || "",
        currentPassword
      );

      // Firebase asks for the old password again before a password can be changed.
      await reauthenticateWithCredential(firebaseUser, credential);

      await updatePassword(firebaseUser, newPassword);

      closePasswordModal();
      showToast("Password changed successfully");
    } catch (error: unknown) {
      const userMessage = getUserFriendlyErrorMessage(
        error,
        "Change buyer password",
        "We couldn't change your password right now. Please try again."
      );

      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;

      if (
        errorCode === "auth/invalid-credential" ||
        errorCode === "auth/wrong-password"
      ) {
        setCurrentPasswordError("Current password is incorrect.");
        return;
      }

      if (errorCode === "auth/weak-password") {
        setNewPasswordError("Choose a stronger password.");
        return;
      }

      showToast(userMessage);
    } finally {
      setSavingPassword(false);
    }
  };

  const closePasswordModal = () => {
    setModalVisible(false);
    setCurrentPassword("");
    setNewPassword("");
    setCurrentPasswordError("");
    setNewPasswordError("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  const openPasswordModal = () => {
    setCurrentPasswordError("");
    setNewPasswordError("");
    setModalVisible(true);
  };

  return (
    <View className="flex-1 bg-white">
      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-white font-bold text-lg ml-4">
          Account Settings
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-8">
          <TouchableOpacity
            onPress={pickImage}
            disabled={loading}
            className="relative"
            activeOpacity={0.8}
          >
            {user?.profileImage ? (
              <Image
                source={{ uri: user.profileImage }}
                className="w-28 h-28 rounded-full"
              />
            ) : (
              <View
                className="w-28 h-28 rounded-full justify-center items-center"
                style={{ backgroundColor: "#f0fdf4" }}
              >
                <MaterialCommunityIcons name="account" size={54} color="#14532d" />
              </View>
            )}

            {loading && (
              <View className="absolute inset-0 rounded-full bg-black/40 justify-center items-center">
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}

            {!loading && (
              <View
                className="absolute bottom-0 right-0 p-2 rounded-full border-2 border-white"
                style={{ backgroundColor: "#14532d" }}
              >
                <MaterialCommunityIcons name="camera" size={16} color="white" />
              </View>
            )}
          </TouchableOpacity>

          <Text className="text-gray-400 text-xs mt-3">
            Tap to change profile photo
          </Text>
        </View>

        <Text className="text-gray-400 text-xs font-semibold uppercase mb-1 ml-1">
          Account
        </Text>

        <View className="mb-6">
          <View className="flex-row items-center justify-between py-4 border-b border-gray-100">
            <View className="flex-row items-center flex-1">
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={20}
                color="#14532d"
              />
              <Text className="ml-3 text-gray-800 font-semibold text-sm">
                Full Name
              </Text>
            </View>

            <Text
              className="text-gray-500 text-sm ml-3 flex-shrink"
              numberOfLines={1}
            >
              {user?.fullName || "—"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center flex-1">
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color="#14532d"
              />
              <Text className="ml-3 text-gray-800 font-semibold text-sm">
                Email
              </Text>
            </View>

            <Text
              className="text-gray-500 text-sm ml-3 flex-shrink"
              numberOfLines={1}
            >
              {user?.email || "—"}
            </Text>
          </View>
        </View>

        <Text className="text-gray-400 text-xs font-semibold uppercase mb-1 ml-1">
          Security
        </Text>

        <View>
          <TouchableOpacity
            className="flex-row items-center justify-between py-4"
            onPress={openPasswordModal}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center flex-1">
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color="#14532d"
              />
              <Text className="ml-3 text-gray-800 font-semibold text-sm">
                Change Password
              </Text>
            </View>

            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <View className="flex-1 justify-center items-center bg-black/40 px-6">
            <View
              className="bg-white w-full rounded-[10px] p-6"
              style={{ borderWidth: 1, borderColor: "#14532d" }}
            >
              <View className="flex-row items-center justify-between mb-5">
                <Text className="text-lg font-bold text-gray-800">
                  Change Password
                </Text>

                <TouchableOpacity
                  onPress={closePasswordModal}
                  className="w-8 h-8 items-center justify-center"
                >
                  <MaterialCommunityIcons name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View className="mb-4">
                <View className={`flex-row items-center rounded-[10px] border bg-gray-100 px-4 ${currentPasswordError ? "border-red-500" : "border-transparent"}`}>
                  <TextInput
                    placeholder="Current Password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showCurrentPassword}
                    value={currentPassword}
                    onChangeText={(value) => {
                      setCurrentPassword(value);
                      setCurrentPasswordError("");
                    }}
                    className="flex-1 py-4 text-gray-800"
                    accessibilityHint={currentPasswordError || undefined}
                  />

                  <TouchableOpacity
                    onPress={() =>
                      setShowCurrentPassword(!showCurrentPassword)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    <MaterialCommunityIcons
                      name={showCurrentPassword ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {currentPasswordError ? (
                  <Text className="mt-1 px-1 text-xs text-red-600">
                    {currentPasswordError}
                  </Text>
                ) : null}
              </View>

              <View className="mb-2">
                <View className={`flex-row items-center rounded-[10px] border bg-gray-100 px-4 ${newPasswordError ? "border-red-500" : "border-transparent"}`}>
                  <TextInput
                    placeholder="New Password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={(value) => {
                      setNewPassword(value);
                      setNewPasswordError("");
                    }}
                    className="flex-1 py-4 text-gray-800"
                    accessibilityHint={newPasswordError || undefined}
                  />

                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    accessibilityRole="button"
                    accessibilityLabel={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    <MaterialCommunityIcons
                      name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {newPasswordError ? (
                  <Text className="mt-1 px-1 text-xs text-red-600">
                    {newPasswordError}
                  </Text>
                ) : null}
              </View>

              <Text className="text-gray-400 text-xs mb-6 ml-1">
                Must be at least 6 characters
              </Text>

              <View className="flex-row">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 py-3.5 rounded-[5px] mr-2 items-center"
                  onPress={closePasswordModal}
                  disabled={savingPassword}
                >
                  <Text className="font-semibold text-gray-700">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 py-3.5 rounded-[5px] ml-2 items-center flex-row justify-center"
                  style={{ backgroundColor: "#14532d", opacity: savingPassword ? 0.7 : 1 }}
                  onPress={handleChangePassword}
                  disabled={savingPassword}
                >
                  {savingPassword ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="font-semibold text-white">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default AccountSetting;