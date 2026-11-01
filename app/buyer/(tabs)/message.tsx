// Chat list for the buyer.
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
import { listenChats } from "../../../src/services/chatService";
import { useBuyerUnreadChats } from "@/src/hooks/useBuyerUnreadChats";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

const BuyerMessages = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadChatIds, markRead } = useBuyerUnreadChats();

  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Watches the buyer's chats and loads the other participant so each row can
  // show the farmer's name and photo.
  useEffect(() => {
    let unsubscribe: any;

    const loadUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem("user");
        if (!userStr) return;

        const user = JSON.parse(userStr);

        unsubscribe = listenChats(
          user.uid,
          async (data) => {
            const formatted = await Promise.all(
              data.map(async (chat: any) => {
                const otherUid = chat.users.find(
                  (u: string) => u !== user.uid
                );

                const userDoc = await getDoc(
                  doc(db, "users", otherUid)
                );

                return {
                  ...chat,
                  otherUserData: userDoc.data(),
                };
              })
            );

            setChats(formatted);
            setLoading(false);
          }
        );
      } catch (error) {
        getUserFriendlyErrorMessage(error, "Load buyer conversations");
        setLoading(false);
      }
    };

    loadUser();

    return () => {
      if (unsubscribe) unsubscribe();
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
          paddingBottom: 112 + insets.bottom,
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
        renderItem={({ item, index }) => (
          <View>
            <TouchableOpacity
              onPress={() => {
                void markRead(item.id).catch((error) =>
                  getUserFriendlyErrorMessage(error, "Mark buyer conversation as read")
                );
                  router.push({
                    pathname: "/buyer/messages/ChatScreen" as any,
                    params: {
                      farmerId: item.otherUserData?.uid,
                      farmerName:
                        item.otherUserData?.farmName ||
                        item.otherUserData?.fullName,
                      farmerProfileImage: item.otherUserData?.profileImage || "",
                    },
                  })
                }}
              className="flex-row items-center py-4 px-2 rounded-[10px]"
              style={
                unreadChatIds.has(item.id)
                  ? { backgroundColor: "#f0fdf4" }
                  : undefined
              }
            >
              <View className="w-12 h-12 rounded-full overflow-hidden items-center justify-center mr-4" style={{ backgroundColor: "#f0fdf4" }}>
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
                <View className="flex-row justify-between items-center">
                  <Text className="font-bold text-gray-800">
                    {item.otherUserData?.farmName ||
                      item.otherUserData?.fullName}
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
                  className="text-gray-500 text-sm mt-1"
                >
                  {item.lastMessage}
                </Text>
              </View>
              {unreadChatIds.has(item.id) && (
                <View className="w-2.5 h-2.5 rounded-full ml-3" style={{ backgroundColor: "#14532d" }} />
              )}
            </TouchableOpacity>
              {index < chats.length - 1 && (
                <View
                  className="h-px"
                  style={{ backgroundColor: "#f3f4f6", marginLeft: 64 }}
                />
              )}
          </View>
        )}
      />
    </View>
  );
};

export default BuyerMessages;