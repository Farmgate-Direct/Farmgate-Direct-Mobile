// Builds the buyer's notification feed out of orders and chats. Home (the bell
// badge) and the Notifications screen both use this hook, so the badge and the
// list always show the same count.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../../FirebaseConfig";
import { listenChats } from "../services/chatService";
import { toMillis } from "../services/notificationService";
import type { OrderType } from "../types/order";
import type { BuyerNotification } from "../types/notification";

// Field in the "orders" collection that holds the buyer's uid. Change it here
// if the backend ever renames the field.
const ORDER_BUYER_FIELD = "buyerId";

// Formats an amount the way the notification text shows it.
const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Falls back to the short document id when an order has no order number yet.
const orderLabel = (o: OrderType) =>
  o.orderNumber || `#${String(o.id || "").slice(0, 6)}`;

export function useBuyerNotifications() {
  const [buyerId, setBuyerId] = useState("");
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [storedNotifications, setStoredNotifications] = useState<
    BuyerNotification[]
  >([]);
  const [chats, setChats] = useState<any[]>([]);
  const [lastSeen, setLastSeen] = useState(0);
  const [seenLoaded, setSeenLoaded] = useState(false);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

// Reads the signed-in user out of local storage, since the app has no session
// store of its own.
  useEffect(() => {
    AsyncStorage.getItem("user").then((s) => {
      if (!s) {
        setLoading(false);
        return;
      }
      try {
        const u = JSON.parse(s);
        setBuyerId(u.uid || u.userId || u.id || "");
      } catch {
        setLoading(false);
      }
    });
  }, []);

// Watches the buyer's orders so status changes show up without a refresh.
  useEffect(() => {
    if (!buyerId) return;
    const q = query(
      collection(db, "orders"),
      where(ORDER_BUYER_FIELD, "==", buyerId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderType))
        );
        setLoading(false);
      },
      (err) => {
        console.log("BUYER NOTIF ORDERS ERROR:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [buyerId]);

  useEffect(() => {
    if (!buyerId) return;
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", buyerId)
    );
    return onSnapshot(
      notificationsQuery,
      (snapshot) => {
        setStoredNotifications(
          snapshot.docs.map(
            (item) =>
              ({
                ...item.data(),
                id: item.id,
              }) as BuyerNotification
          )
        );
      },
      (error) => {
        console.error("BUYER NOTIFICATIONS ERROR:", error);
      }
    );
  }, [buyerId]);

// Watches the buyer's chats and looks up the other participant, so a message
  // can be shown with the farmer's name and photo.
  useEffect(() => {
    if (!buyerId) return;
    const unsub = listenChats(buyerId, async (data: any) => {
      try {
        const formatted = await Promise.all(
          (data || []).map(async (chat: any) => {
            try {
              const otherUid = (chat.users || []).find(
                (u: string) => u !== buyerId
              );
              if (!otherUid) return chat;
              const udoc = await getDoc(doc(db, "users", otherUid));
              return {
                ...chat,
                otherUserData: udoc.exists() ? udoc.data() : null,
              };
            } catch {
              return chat;
            }
          })
        );
        setChats(formatted);
      } catch {
        setChats(data || []);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [buyerId]);

// Reloads the last-seen marker and the in-app setting each time the screen
  // comes back into focus.
  useFocusEffect(
    useCallback(() => {
      if (!buyerId) return;
      const key = `buyer-notif-seen-${buyerId}`;
      AsyncStorage.getItem(key).then(async (v) => {
        if (v) {
          setLastSeen(Number(v) || 0);
        } else {
          // On the very first visit the marker starts at now, so old orders do not all
          // appear as unread at once.
          const now = Date.now();
          setLastSeen(now);
          await AsyncStorage.setItem(key, String(now)).catch(() => {});
        }
        setSeenLoaded(true);
      });
      AsyncStorage.getItem(`notif-settings-${buyerId}`).then((raw) => {
        if (!raw) return;
        try {
          setInAppEnabled(JSON.parse(raw)?.inApp !== false);
        } catch {}
      });
    }, [buyerId])
  );

  // Records that the buyer has seen the feed up to now, which clears the badge.
  const markSeen = useCallback(() => {
    if (!buyerId) return;
    const now = Date.now();
    setLastSeen(now);
    AsyncStorage.setItem(`buyer-notif-seen-${buyerId}`, String(now)).catch(
      () => {}
    );
  }, [buyerId]);

// Turns the latest orders and chats into feed entries. Orders are capped at 15
  // and chats at 10 so the list stays short.
  const items = useMemo(() => {
    const list: BuyerNotification[] = [...storedNotifications];

    const latestOrders = [...orders]
      .sort(
        (a, b) =>
          toMillis((b as any).updatedAt || b.createdAt) -
          toMillis((a as any).updatedAt || a.createdAt)
      )
      .slice(0, 15);

    latestOrders.forEach((o) => {
      const farm = o.farmName || "the farm";
      const no = orderLabel(o);
      const base = { orderId: o.id } as const;

      switch (o.status) {
        case "pending":
          // The buyer placed the order, so there is nothing to tell them yet.
          break;
        case "processing":
          list.push({
            ...base,
            id: `order-processing-${o.id}`,
            kind: "order",
            title: "Order accepted",
            body: `${farm} is preparing your order ${no}.`,
            createdAt: (o as any).updatedAt || o.createdAt,
          });
          break;
        case "delivered":
          list.push({
            ...base,
            id: `order-delivered-${o.id}`,
            kind: "order",
            title: "Order delivered",
            body: `Your order ${no} from ${farm} was delivered.`,
            createdAt:
              (o as any).deliveredAt || (o as any).updatedAt || o.createdAt,
          });
          break;
        case "claimed":
          list.push({
            ...base,
            id: `order-claimed-${o.id}`,
            kind: "order",
            title: "Order claimed",
            body: `Your order ${no} from ${farm} was claimed.`,
            createdAt:
              (o as any).deliveredAt || (o as any).updatedAt || o.createdAt,
          });
          break;
        case "cancelled":
          if (o.autoCancelled) {
            const hasStoredCancellation = storedNotifications.some(
              (notification) =>
                notification.orderId === o.id &&
                notification.title === "Order Automatically Cancelled"
            );
            if (!hasStoredCancellation) {
              list.push({
                ...base,
                id: `order-auto-cancelled-${o.id}`,
                kind: "system",
                title: "Order Automatically Cancelled",
                body: "Your order has been automatically cancelled because the farmer did not accept it within 2 days.",
                createdAt:
                  o.autoCancelledAt || (o as any).cancelledAt || o.updatedAt || o.createdAt,
              });
            }
          } else {
            list.push({
              ...base,
              id: `order-cancelled-${o.id}`,
              kind: "system",
              title: "Order cancelled",
              body: `Order ${no} was cancelled.`,
              createdAt:
                (o as any).cancelledAt || (o as any).updatedAt || o.createdAt,
            });
          }
          break;
        default:
          list.push({
            ...base,
            id: `order-status-${o.id}`,
            kind: "system",
            title: "Order update",
            body: `Order ${no} is now ${String(o.status)}.`,
            createdAt: (o as any).updatedAt || o.createdAt,
          });
      }

      if (o.payment === "gcash" && o.paymentStatus === "paid") {
        list.push({
          ...base,
          id: `payment-${o.id}`,
          kind: "payment",
          title: "Payment confirmed",
          body: `Your payment for Order ${no} (${peso(Number(o.total || 0))}) was received.`,
          createdAt: (o as any).paidAt || (o as any).updatedAt || o.createdAt,
        });
      }
    });

    [...chats]
      .sort(
        (a, b) =>
          toMillis(b.lastMessageTime || b.updatedAt) -
          toMillis(a.lastMessageTime || a.updatedAt)
      )
      .slice(0, 10)
      .forEach((c) => {
        const farmerId = (c.users || []).find(
          (uid: string) => uid !== buyerId
        );
        if (!farmerId || c.lastSenderId !== farmerId) return;
        if (!c.lastMessage) return;

        const name =
          c.otherUserData?.farmName || c.otherUserData?.fullName || "a farmer";
        list.push({
          id: `message-${c.id}`,
          kind: "message",
          title: "New message",
          body: `New message from ${name}: ${String(c.lastMessage || "").slice(0, 60)}`,
          chatId: c.id,
          farmerId,
          farmerName: c.otherUserData?.farmName || c.otherUserData?.fullName || "Farmer",
          farmerProfileImage: c.otherUserData?.profileImage || "",
          createdAt: c.lastMessageTime || c.updatedAt,
        });
      });

    return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [orders, chats, buyerId, storedNotifications]);

  // Anything newer than the last-seen marker counts as unread.
  const unreadCount = useMemo(
    () => items.filter((n) => toMillis(n.createdAt) > lastSeen).length,
    [items, lastSeen]
  );

  return {
    items,
    unreadCount,
    lastSeen,
    seenLoaded,
    markSeen,
    inAppEnabled,
    loading,
  };
}