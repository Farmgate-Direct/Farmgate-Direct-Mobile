// Notifications shown in the farmer's notification list.
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { NotificationType } from "../types/notification";

// Firestore stores timestamps in several shapes, so this normalizes all of
// them to milliseconds. Unusable values become 0.
export const toMillis = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.toDate === "function") {
    try {
      return ts.toDate().getTime();
    } catch {
      return 0;
    }
  }
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") {
    const p = new Date(ts).getTime();
    return Number.isFinite(p) ? p : 0;
  }
  return 0;
};

// Same as toMillis, but returns a Date, or null when the value is unusable.
export const toDate = (ts: any): Date | null => {
  const ms = toMillis(ts);
  if (!ms) return null;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
};

// Watches a farmer's notifications and calls the callback whenever they change.
// Returns the function that stops watching.
export const subscribeToFarmerNotifications = (
  farmerId: string,
  callback: (items: NotificationType[]) => void
) => {
  if (!farmerId) {
    callback([]);
    return () => {};
  }

  // Sorting happens on the client so the query does not need a composite index.
  const q = query(
    collection(db, "notifications"),
    where("farmerId", "==", farmerId)
  );

  const fallback = query(
    collection(db, "notifications"),
    where("userId", "==", farmerId)
  );

  let primary: NotificationType[] = [];
  let secondary: NotificationType[] = [];
  let unsubFallback: (() => void) | null = null;

  const emit = () => {
    const merged = [...primary, ...secondary].sort(
      (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
    );
    callback(merged);
  };

  const unsubPrimary = onSnapshot(
    q,
    (snap) => {
      primary = snap.docs.map(
        (d) =>
          ({
            id: d.id,
            ...(d.data() as Omit<NotificationType, "id">),
          } as NotificationType)
      );
      emit();
    },
    (err) => {
      console.log("NOTIFICATIONS SNAPSHOT ERROR:", err);
      callback([]);
    }
  );

  // Older records were written with userId instead of farmerId, so watch both
  // fields and merge the results.
  try {
    unsubFallback = onSnapshot(
      fallback,
      (snap) => {
        secondary = snap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...(d.data() as Omit<NotificationType, "id">),
            } as NotificationType)
        );
        emit();
      },
      () => {}
    );
  } catch {
    unsubFallback = null;
  }

  return () => {
    unsubPrimary();
    if (unsubFallback) unsubFallback();
  };
};

// Reads a farmer's notifications once, newest first.
export const getFarmerNotifications = async (
  farmerId: string
): Promise<NotificationType[]> => {
  try {
    const q = query(
      collection(db, "notifications"),
      where("farmerId", "==", farmerId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(
        (d) =>
          ({
            id: d.id,
            ...(d.data() as Omit<NotificationType, "id">),
          } as NotificationType)
      )
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  } catch (e) {
    console.log("GET NOTIFICATIONS ERROR:", e);
    return [];
  }
};

// Marks one notification as read.
export const markNotificationRead = async (id: string) => {
  try {
    await updateDoc(doc(db, "notifications", id), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.log("MARK NOTIF READ ERROR:", e);
  }
};

// Marks every unread notification of a farmer as read in a single batch.
export const markAllNotificationsRead = async (farmerId: string) => {
  try {
    const items = await getFarmerNotifications(farmerId);
    const unread = items.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "notifications", n.id), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (e) {
    console.log("MARK ALL READ ERROR:", e);
  }
};

// Splits notifications into the Today, Yesterday, and Earlier sections the
// list screen shows.
export const groupNotificationsByDay = (items: NotificationType[]) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  const today: NotificationType[] = [];
  const yesterday: NotificationType[] = [];
  const earlier: NotificationType[] = [];

  items.forEach((n) => {
    const d = toDate(n.createdAt) ?? new Date(0);
    if (d >= startOfToday) today.push(n);
    else if (d >= startOfYesterday) yesterday.push(n);
    else earlier.push(n);
  });

  const groups: { label: string; data: NotificationType[] }[] = [];
  if (today.length) groups.push({ label: "Today", data: today });
  if (yesterday.length) groups.push({ label: "Yesterday", data: yesterday });
  if (earlier.length) groups.push({ label: "Earlier", data: earlier });
  return groups;
};

// Renders a timestamp as a short relative label such as "5m ago". Anything older
// than a week falls back to a date.
export const timeAgo = (ts: any): string => {
  const ms = toMillis(ts);
  if (!ms) return "";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const d = new Date(ms);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

// Re-exported so screens can build queries without importing Firestore directly.
export { orderBy };