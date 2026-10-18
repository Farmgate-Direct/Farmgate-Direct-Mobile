// Farmer notification settings screen.
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { db } from "../../../FirebaseConfig";
import { NotificationSettings } from "../../../src/types/notification";

const DEFAULTS: NotificationSettings = { email: true, inApp: true, updates: false };

// Main settings screen for notification toggles.
export default function NotificationSettingsScreen() {
  const [farmerId, setFarmerId] = useState("");
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

// The stored value on the device is read first.
  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem("user");
        if (!s) {
          setLoading(false);
          return;
        }
        const u = JSON.parse(s);
        const uid = u.uid || u.userId || u.id || "";
        setFarmerId(uid);

        // The value on the device is read first.
        let local: NotificationSettings = DEFAULTS;
        try {
          const raw = await AsyncStorage.getItem(`notif-settings-${uid}`);
          if (raw) local = { ...DEFAULTS, ...JSON.parse(raw) };
        } catch {}

        // The copy in Firestore wins whenever it exists.
        try {
          if (uid) {
            const snap = await getDoc(doc(db, "users", uid));
            const remote = (snap.data() as any)?.notificationSettings;
            if (remote) local = { ...local, ...remote };
          }
        } catch {}

        setSettings(local);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

// Saves a toggle on the device and in Firestore.
  const persist = async (next: NotificationSettings) => {
    setSettings(next);
    if (!farmerId) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(`notif-settings-${farmerId}`, JSON.stringify(next));
      try {
        await updateDoc(doc(db, "users", farmerId), { notificationSettings: next });
      } catch {
        // The Firestore write is best effort, so a failure still leaves the
        // value applied on this device.
      }
    } finally {
      setSaving(false);
    }
  };

  const rows: {
    key: keyof NotificationSettings;
    title: string;
    desc: string;
  }[] = [
    {
      key: "email",
      title: "Email notifications",
      desc: "Receive order and payment updates by email.",
    },
    {
      key: "inApp",
      title: "In-app notifications",
      desc: "Show order, message and payment alerts inside the app.",
    },
    {
      key: "updates",
      title: "Update application",
      desc: "Get notified about new features and app updates.",
    },
  ];

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#14532D" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F6F6F6]">
      <View className="bg-[#14532D] px-5 pt-14 pb-4 flex-row items-center border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={22} color="#ffff" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[17px] font-semibold text-white -ml-6">
          Notifications setting
        </Text>
        <View className="w-7" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="text-gray-500 text-[13px] leading-5 px-1">
          In this section, you will be able to manage push notifications. You will continue to
          receive in-app notifications for security reasons or if we need to send critical
          information about your account.
        </Text>

        <View className="bg-white rounded-2xl mt-4 px-5 py-2 shadow-sm">
          {rows.map((r, idx) => (
            <View
              key={r.key}
              className={`flex-row items-center justify-between py-4 ${idx !== rows.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <View className="flex-1 pr-4">
                <Text className="font-semibold text-gray-900 text-[14px]">{r.title}</Text>
                <Text className="text-gray-400 text-[12px] mt-1">{r.desc}</Text>
              </View>
              <Switch
                value={settings[r.key]}
                onValueChange={(v) => persist({ ...settings, [r.key]: v })}
                trackColor={{ false: "#E5E7EB", true: "#14532D" }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        {saving && (
          <Text className="text-center text-gray-400 text-xs mt-3">Saving…</Text>
        )}
      </ScrollView>
    </View>
  );
}