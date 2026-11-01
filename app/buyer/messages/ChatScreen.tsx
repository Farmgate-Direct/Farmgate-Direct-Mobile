// Buyer chat screen with a farmer.
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";

import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createChatId,
  listenMessages,
  markChatRead,
  sendMessage,
} from "../../../src/services/chatService";
import { useToast } from "@/src/context/ToastContext";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

const BuyerChatScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { farmerId, farmerName, farmerProfileImage } = useLocalSearchParams();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [chatId, setChatId] = useState("");

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let unsubscribe: any;

    const loadUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem("user");
        if (!userStr) return;

        const user = JSON.parse(userStr);
        setBuyerId(user.uid);

        const id = createChatId(user.uid, String(farmerId));
        setChatId(id);

        unsubscribe = listenMessages(id, (newMessages) => {
          setMessages(newMessages);
          if (newMessages.length > 0) {
            void markChatRead(id, user.uid).catch((error) =>
              getUserFriendlyErrorMessage(error, "Mark buyer chat as read")
            );
          }
        });
      } catch (error) {
        showToast(
          getUserFriendlyErrorMessage(
            error,
            "Open buyer chat",
            "We couldn't open this chat right now. Please try again in a moment."
          )
        );
      }
    };

    loadUser();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [farmerId, showToast]);

const handleSend = async () => {
    if (!text.trim() || !chatId || !buyerId) return;

    try {
      await sendMessage({
        chatId,
        senderId: buyerId,
        receiverId: String(farmerId),
        text,
      });

      setText("");
    } catch (error) {
      showToast(
        getUserFriendlyErrorMessage(
          error,
          "Send buyer chat message",
          "Your message couldn't be sent right now. Please try again."
        )
      );
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="bg-green-900 pt-14 pb-4 px-5 rounded-b-2xl flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>

        <View className="w-10 h-10 rounded-full overflow-hidden items-center justify-center ml-3" style={{ backgroundColor: "#f0fdf4" }}>
          {farmerProfileImage ? (
            <Image
              source={{ uri: String(farmerProfileImage) }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <MaterialCommunityIcons name="account" size={20} color="#14532d" />
          )}
        </View>

        <Text className="text-white text-lg font-bold ml-3">
          {farmerName || "Farmer"}
        </Text>
      </View>

      <View className="flex-1 bg-gray-50 px-4 pt-4">
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View className="items-center mt-20">
              <MaterialCommunityIcons
                name="chat-outline"
                size={50}
                color="#d1d5db"
              />
              <Text className="text-gray-400 mt-3">
                No messages yet. Say hi!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === "system") {
              return (
                <View className="mb-3 items-center">
                  <View className="max-w-[90%] rounded-xl bg-gray-200 px-3 py-2">
                    <Text className="text-center text-xs text-gray-700">
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }
            const isMe = item.senderId === buyerId;

            return (
              <View
                className={`mb-3 flex-row ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                <View
                  className={`px-4 py-2 rounded-2xl max-w-[75%] ${
                    isMe ? "rounded-br-none" : "bg-white rounded-bl-none"
                  }`}
                  style={isMe ? { backgroundColor: "#14532d" } : undefined}
                >
                  <Text
                    className={
                      isMe ? "text-white" : "text-gray-800"
                    }
                  >
                    {item.text}
                  </Text>
                  <Text
                    className={`text-[10px] mt-1 ${
                      isMe ? "text-green-200" : "text-gray-400"
                    }`}
                  >
                    {item.createdAt?.toDate
                      ? item.createdAt
                          .toDate()
                          .toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                      : ""}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      </View>

      <View
        className="bg-white px-3 py-2"
        style={{ marginBottom: 20 + insets.bottom }}
      >
        <View className="flex-row items-center bg-gray-100 rounded-full px-2 py-1">
          <TextInput
            placeholder="Type a message..."
            className="flex-1 px-2 py-2 text-gray-700"
            placeholderTextColor="#9ca3af"
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            className="p-3 rounded-full"
            style={{ backgroundColor: "#14532d" }}
          >
            <MaterialCommunityIcons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default BuyerChatScreen;