// The in-app notification a buyer or farmer receives: order updates, chat
// messages, payment results, and system notices.
export type NotificationKind = "order" | "message" | "payment" | "system";

// A buyer-facing feed item composed from order and chat documents.
export type BuyerNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: any;
  orderId?: string;
  productId?: string;
  chatId?: string;
  farmerId?: string;
  farmerName?: string;
  farmerProfileImage?: string;
};

// One notification document. kind decides which of orderId, chatId, or amount
// is filled in, and createdAt is a Firestore timestamp rather than a number.
export type NotificationType = {
  id: string;
  farmerId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  orderId?: string | null;
  productId?: string | null;
  chatId?: string | null;
  amount?: number | null;
  read: boolean;
  createdAt: any;
};

// Which channels a user has turned on. The first two control delivery, and
// updates gates the order-related notifications specifically.
export type NotificationSettings = {
  email: boolean;
  inApp: boolean;
  updates: boolean;
};
