// Farmer account settings: profile photo, phone number, and password.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
    useRouter,
} from "expo-router";
import { useToast } from "../../../context/ToastContext";
import { formatPhilippinePhoneNumber } from "../../../utils/validators";

import React, {
    useEffect,
    useState,
} from "react";

import {
    Image,
    Text,
    TouchableOpacity,
    View,
    TextInput,
    Modal,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import { useFarmerAlert } from "@/context/FarmerAlertContext";

import * as ImagePicker
    from "expo-image-picker";

import {
    doc,
    updateDoc,
} from "firebase/firestore";

import {
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    getAuth,
} from "firebase/auth";

import { db }
    from "../../../FirebaseConfig";

import {
    uploadProfileImageAsync,
} from "@/src/services/cloudinaryProfileService";

import {
    deleteCloudinaryImage,
} from "../../../src/services/deleteImageService";

const AccountSetting = () => {
    const Alert = useFarmerAlert();

    const router = useRouter();
    const { showToast } = useToast();

    const auth = getAuth();

    const [user, setUser] =
        useState<any>(null);

    const [loading, setLoading] =
        useState(false);

    const [modalVisible, setModalVisible] =
        useState(false);

    const [currentPassword, setCurrentPassword] =
        useState("");

    const [newPassword, setNewPassword] =
        useState("");
    const [currentPasswordError, setCurrentPasswordError] =
        useState("");
    const [newPasswordError, setNewPasswordError] =
        useState("");
    const [showCurrentPassword, setShowCurrentPassword] =
        useState(false);
    const [showNewPassword, setShowNewPassword] =
        useState(false);
    const [editingPhone, setEditingPhone] =
        useState(false);
    const [phoneDraft, setPhoneDraft] =
        useState("");
    const [savingPhone, setSavingPhone] =
        useState(false);

    // Reads the stored profile on mount.
    useEffect(() => {

        const loadUser = async () => {

            const userStr =
                await AsyncStorage.getItem(
                    "user"
                );

            if (!userStr) return;

            setUser(
                JSON.parse(userStr)
            );
        };

        loadUser();

    }, []);

    const handleSavePhone = async () => {
        const enteredPhone = phoneDraft.trim();
        if (!/^(09\d{9}|\+639\d{9})$/.test(enteredPhone)) {
            showToast("Enter a valid Philippine mobile number, such as +639XXXXXXXXX.");
            return;
        }
        const phone = enteredPhone.startsWith("09")
            ? `+63${enteredPhone.slice(1)}`
            : enteredPhone;

        const userId = user?.uid || user?.userId || user?.id;
        if (!userId) {
            showToast("User session not found.");
            return;
        }

        try {
            setSavingPhone(true);
            await updateDoc(doc(db, "users", userId), { phone });

            const updatedUser = { ...user, phone };
            setUser(updatedUser);
            setEditingPhone(false);
            try {
                await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
            } catch (error) {
                console.error("SYNC PHONE NUMBER TO STORAGE ERROR:", error);
                showToast("Phone number saved, but local profile sync failed.");
                return;
            }
            showToast("Phone number updated.");
        } catch (error) {
            console.error("UPDATE PHONE NUMBER ERROR:", error);
            showToast("Failed to update phone number. Please try again.");
        } finally {
            setSavingPhone(false);
        }
    };

    // Lets the farmer pick, crop, and upload a new profile photo.
    const pickImage =
        async () => {

            try {

                const permission =
                    await ImagePicker.requestMediaLibraryPermissionsAsync();

                if (
                    permission.status !==
                    "granted"
                ) {

                    Alert.alert(
                        "Permission needed",
                        "Please allow gallery access"
                    );

                    return;
                }

                const result =
                    await ImagePicker.launchImageLibraryAsync({
                        mediaTypes:
                            ImagePicker.MediaTypeOptions.Images,

                        allowsEditing: true,

                        aspect: [1, 1],

                        quality: 0.7,
                    });

                if (
                    result.canceled
                ) return;

                setLoading(true);

                const uploaded =
                    await uploadProfileImageAsync(
                        result.assets[0].uri
                    );

                const userId =
                    user.uid ||
                    user.userId ||
                    user.id;

                // Remove the previous photo so it does not stay in Cloudinary
                // forever.
                if (
                    user?.profileImagePublicId
                ) {

                    await deleteCloudinaryImage(
                        user.profileImagePublicId
                    );

                }

                await updateDoc(
                    doc(
                        db,
                        "users",
                        userId
                    ),
                    {
                        profileImage:
                            uploaded.imageUrl,

                        profileImagePublicId:
                            uploaded.publicId,
                    }
                );

                // Keep the copy in local storage in sync with Firestore.
                const updatedUser = {

                    ...user,

                    profileImage:
                        uploaded.imageUrl,

                    profileImagePublicId:
                        uploaded.publicId,
                };

                await AsyncStorage.setItem(
                    "user",
                    JSON.stringify(
                        updatedUser
                    )
                );

                setUser(updatedUser);

                Alert.alert(
                    "Success",
                    "Profile updated"
                );

            } catch (error) {

                console.log(error);

                Alert.alert(
                    "Error",
                    "Failed to upload image"
                );

            } finally {

                setLoading(false);

            }
        };

    const handleChangePassword =
        async () => {

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
                if (
                    currentPassword ===
                    newPassword
                ) {

                    setNewPasswordError("New password must be different from your current password.");

                    return;
                }

                if (
                    newPassword.length < 6
                ) {

                    setNewPasswordError("Password must be at least 6 characters.");

                    return;
                }

                const firebaseUser =
                    auth.currentUser;

                if (!firebaseUser) {

                    showToast("User not found.");

                    return;
                }

                const credential =
                    EmailAuthProvider.credential(
                        firebaseUser.email || "",
                        currentPassword
                    );

                // Firebase asks for the old password again before a password can be changed.
                await reauthenticateWithCredential(
                    firebaseUser,
                    credential
                );

                await updatePassword(
                    firebaseUser,
                    newPassword
                );

                closePasswordModal();
                showToast("Password changed successfully.");

            } catch (error: unknown) {

                console.log(error);

                const errorCode =
                    typeof error === "object" && error !== null && "code" in error
                        ? error.code
                        : undefined;

                if (errorCode === "auth/invalid-credential" || errorCode === "auth/wrong-password") {
                    setCurrentPasswordError("Current password is incorrect.");
                    return;
                }

                if (errorCode === "auth/weak-password") {
                    setNewPasswordError("Choose a stronger password.");
                    return;
                }

                showToast(
                    error instanceof Error
                        ? error.message
                        : "Failed to change password. Please try again."
                );
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

    return (
        <View className="flex-1 bg-white">

            <View className="flex-row items-center bg-green-900 px-5 pb-4 pt-14">

                <TouchableOpacity
                    onPress={() =>
                        router.back()
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >

                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color="white"
                    />

                </TouchableOpacity>

                <Text className="ml-4 text-lg font-bold text-white">
                    Account Settings
                </Text>

            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >

                <View className="mb-8 items-center">

                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={loading}
                        className="relative"
                        activeOpacity={0.8}
                    >

                        {user?.profileImage ? (

                            <Image
                                source={{
                                    uri:
                                        user.profileImage,
                                }}
                                className="h-28 w-28 rounded-full"
                            />

                        ) : (

                            <View className="h-28 w-28 items-center justify-center rounded-full" style={{ backgroundColor: "#f0fdf4" }}>

                                <MaterialCommunityIcons
                                    name="account"
                                    size={54}
                                    color="#14532d"
                                />

                            </View>

                        )}

                        {loading && (
                            <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            </View>
                        )}

                        {!loading && (
                            <View className="absolute bottom-0 right-0 rounded-full border-2 border-white p-2" style={{ backgroundColor: "#14532d" }}>
                                <MaterialCommunityIcons
                                    name="camera"
                                    size={16}
                                    color="white"
                                />
                            </View>
                        )}

                    </TouchableOpacity>

                    <Text className="mt-3 text-xs text-gray-400">
                        Tap to change profile photo
                    </Text>
                </View>

                <Text className="mb-1 ml-1 text-xs font-semibold uppercase text-gray-400">
                    Account
                </Text>

                <View className="flex-row items-center justify-between border-b border-gray-100 py-4">

                    <View className="flex-1 flex-row items-center">

                        <MaterialCommunityIcons
                            name="account-circle-outline"
                            size={20}
                            color="#14532d"
                        />

                        <Text className="ml-3 text-sm font-semibold text-gray-800">
                            Full Name
                        </Text>

                    </View>

                    <Text className="ml-3 flex-shrink text-sm text-gray-500" numberOfLines={1}>
                        {user?.fullName || "—"}
                    </Text>

                </View>

                <View className="flex-row items-center justify-between border-b border-gray-100 py-4">

                    <View className="flex-1 flex-row items-center">

                        <MaterialCommunityIcons
                            name="email-outline"
                            size={20}
                            color="#14532d"
                        />

                        <Text className="ml-3 text-sm font-semibold text-gray-800">
                            Email
                        </Text>

                    </View>

                    <Text className="ml-3 flex-shrink text-sm text-gray-500" numberOfLines={1}>
                        {user?.email || "—"}
                    </Text>

                </View>
                <View className="border-b border-gray-100 py-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 flex-row items-center">

                        <MaterialCommunityIcons
                            name="phone-outline"
                            size={20}
                            color="#14532d"
                        />

                        <Text className="ml-3 text-sm font-semibold text-gray-800">
                            Phone Number
                        </Text>

                      </View>
                      {!editingPhone && (
                        <TouchableOpacity
                          onPress={() => {
                            setPhoneDraft(user?.phone || "");
                            setEditingPhone(true);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Edit phone number"
                          className="px-2 py-1"
                        >
                          <Text className="text-sm font-semibold text-[#14532d]">Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {editingPhone ? (
                      <View className="mt-3">
                        <TextInput
                          value={phoneDraft}
                          onChangeText={setPhoneDraft}
                            placeholder="+639XXXXXXXXX"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="phone-pad"
                          autoComplete="tel"
                          maxLength={13}
                          editable={!savingPhone}
                          className="rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-3 text-gray-800"
                        />
                        <View className="mt-3 flex-row justify-end">
                          <TouchableOpacity
                            onPress={() => {
                              setEditingPhone(false);
                              setPhoneDraft("");
                            }}
                            disabled={savingPhone}
                            className="mr-2 rounded-[10px] bg-gray-100 px-4 py-2.5"
                          >
                            <Text className="font-semibold text-gray-700">Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleSavePhone}
                            disabled={savingPhone}
                            className="min-w-[88px] items-center rounded-[10px] px-4 py-2.5"
                            style={{ backgroundColor: "#14532d", opacity: savingPhone ? 0.7 : 1 }}
                          >
                            {savingPhone ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text className="font-semibold text-white">Save</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <Text className="ml-8 mt-2 text-sm text-gray-500" numberOfLines={1}>
                        {user?.phone ? formatPhilippinePhoneNumber(user.phone) : "—"}
                      </Text>
                    )}
                </View>

                <Text className="mb-1 ml-1 mt-5 text-xs font-semibold uppercase text-gray-400">
                    Security
                </Text>

                <TouchableOpacity
                    className="flex-row items-center justify-between py-4"
                    onPress={() => {
                        setCurrentPasswordError("");
                        setNewPasswordError("");
                        setModalVisible(true)
                    }}
                    activeOpacity={0.7}
                >

                    <View className="flex-1 flex-row items-center">

                        <MaterialCommunityIcons
                            name="lock-outline"
                            size={20}
                            color="#14532d"
                        />

                        <Text className="ml-3 text-sm font-semibold text-gray-800">
                            Change Password
                        </Text>

                    </View>

                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color="#9ca3af"
                    />

                </TouchableOpacity>

            </ScrollView>

            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={closePasswordModal}
            >

                <View className="flex-1 justify-center items-center bg-black/40 px-6">

                    <View className="w-full rounded-[10px] bg-white p-6">

                        <Text className="mb-5 text-lg font-bold text-gray-800">
                            Change Password
                        </Text>

                        <View className="mb-4">
                            <View className={`flex-row items-center rounded-[10px] border bg-gray-50 px-4 ${currentPasswordError ? "border-red-500" : "border-gray-200"}`}>
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
                                    onPress={() => setShowCurrentPassword((visible) => !visible)}
                                    accessibilityRole="button"
                                    accessibilityLabel={showCurrentPassword ? "Hide current password" : "Show current password"}
                                    className="ml-3 p-1"
                                >
                                    <MaterialCommunityIcons
                                        name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
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

                        <View className="mb-6">
                            <View className={`flex-row items-center rounded-[10px] border bg-gray-50 px-4 ${newPasswordError ? "border-red-500" : "border-gray-200"}`}>
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
                                    onPress={() => setShowNewPassword((visible) => !visible)}
                                    accessibilityRole="button"
                                    accessibilityLabel={showNewPassword ? "Hide new password" : "Show new password"}
                                    className="ml-3 p-1"
                                >
                                    <MaterialCommunityIcons
                                        name={showNewPassword ? "eye-off-outline" : "eye-outline"}
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

                        <View className="flex-row">

                            <TouchableOpacity
                                className="mr-2 flex-1 items-center rounded-[5px] bg-gray-200 py-3.5"
                                onPress={closePasswordModal}
                            >

                                <Text className="font-semibold text-gray-700">
                                    Cancel
                                </Text>

                            </TouchableOpacity>

                            <TouchableOpacity
                                className="ml-2 flex-1 items-center rounded-[5px] py-3.5"
                                style={{ backgroundColor: "#14532d" }}
                                onPress={
                                    handleChangePassword
                                }
                            >

                                <Text className="font-semibold text-white">
                                    Save
                                </Text>

                            </TouchableOpacity>

                        </View>

                    </View>

                </View>

            </Modal>

        </View>
    );
};

export default AccountSetting;