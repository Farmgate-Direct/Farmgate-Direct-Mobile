// Farmer chat list screen.
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../FirebaseConfig";
import { listenChats, markChatRead } from "../../../src/services/chatService";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";
import { getFarmerTabBarClearance } from "@/src/constants/farmerLayout";

// Turns a Firestore timestamp into milliseconds.
const toMillis = (value: any) => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  return 0;
};

// Main message list component.
const Messages = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [chats, setChats] = useState<any[]>([]);
  const [farmerId, setFarmerId] = useState("");
  const [loading, setLoading] = useState(true);

// Watches the farmer's chats and loads the buyer behind each one.
  useEffect(() => {
    let unsubscribe: any;

    const loadUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem("user");
        if (!userStr) return;

        const user = JSON.parse(userStr);
        const uid = user.uid || user.userId || user.id;
        if (!uid) {
          setLoading(false);
          return;
        }
        setFarmerId(uid);

        unsubscribe = listenChats(
          uid,
          async (data) => {
            const formatted = await Promise.all(
              data.map(async (chat: any) => {
                const otherUid = chat.users.find(
                  (u: string) => u !== uid
                );

                const userDoc = await getDoc(
                  doc(db, "users", otherUid)
                );

                return {
                  ...chat,
                  otherUserId: otherUid,
                  otherUserData: userDoc.data(),
                };
              })
            );

            setChats(formatted);
            setLoading(false);
          }
        );
      } catch (error) {
        getUserFriendlyErrorMessage(error, "Load farmer conversations");
        setLoading(false);
      }
    };

    loadUser();

    return () => {
      if (unsubscribe) unsubscribe(); // ✅ cleanup
    };
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#14532d" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">
        <Text className="text-white font-bold text-lg ml-4">
          Messages
        </Text>
      </View>

      <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: getFarmerTabBarClearance(insets.bottom),
          }}
          ListEmptyComponent={
            <View className="items-center mt-20">
              <MaterialCommunityIcons
                name="chat-outline"
                size={60}
                color="#d1d5db"
              />
              <Text className="text-gray-400 mt-4">
                No messages yet.
              </Text>
            </View>
          }
// A chat stays highlighted until the farmer reads the reply.
          renderItem={({ item, index }) => {
            const isUnread =
              item.lastSenderId !== farmerId &&
              toMillis(item.lastMessageTime) >
                toMillis(item.lastReadAt?.[farmerId]);

            return (
              <View>
              <TouchableOpacity
                onPress={() => {
                  void markChatRead(item.id, farmerId).catch((error) =>
                    getUserFriendlyErrorMessage(error, "Mark farmer conversation as read")
                  );
                  router.push({
                  pathname: "/farmer/chats/chat",
                  params: {
                    buyerId: item.otherUserId,
                    buyerName: item.otherUserData?.fullName,
                    buyerProfileImage: item.otherUserData?.profileImage || "",
                  },
                  });
                }}
                className="flex-row items-center rounded-[10px] px-2 py-4"
                style={isUnread ? { backgroundColor: "#f0fdf4" } : undefined}
              >
                <View
                  className="mr-4 h-12 w-12 items-center justify-center overflow-hidden rounded-full"
                  style={{ backgroundColor: "#f0fdf4" }}
                >
                  {item.otherUserData?.profileImage ? (
                    <Image
                      source={{ uri: item.otherUserData.profileImage }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <MaterialCommunityIcons name="account" size={24} color="#14532d" />
                  )}
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`font-bold ${
                        isUnread ? "text-gray-900" : "text-gray-800"
                      }`}
                    >
                      {item.otherUserData?.fullName}
                    </Text>
                    <Text className="text-xs text-gray-400">
                      {item.lastMessageTime?.toDate
                        ? item.lastMessageTime
                            .toDate()
                            .toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                        : ""}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    className={`mt-1 text-sm ${
                      isUnread
                        ? "font-semibold text-gray-800"
                        : "text-gray-500"
                    }`}
                  >
                    {item.lastMessage}
                  </Text>
                </View>
                {isUnread && (
                  <View
                    className="ml-3 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: "#14532d" }}
                  />
                )}
              </TouchableOpacity>
              {index < chats.length - 1 && (
                <View
                  className="h-px"
                  style={{ backgroundColor: "#f3f4f6", marginLeft: 64 }}
                />
              )}
              </View>
            );
          }}
        />
    </View>
  );
};

export default Messages;