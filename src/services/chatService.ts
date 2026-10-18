// Chat conversations and messages exchanged between a buyer and a farmer.
import {
  addDoc,
  collection,
  doc,
  FieldPath,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../FirebaseConfig";

// Builds the chat id shared by two users. Sorting the ids first means both
// sides end up with the same id no matter who opened the chat.
export const createChatId = (
  uid1: string,
  uid2: string
) => {
  return [uid1, uid2].sort().join("_");
};

// Stores a message and updates the chat preview. Empty messages are ignored.
export const sendMessage = async ({
  chatId,
  senderId,
  receiverId,
  text,
}: {
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
}) => {
  if (!text.trim()) return;

  await setDoc(
    doc(db, "chats", chatId),
    {
      users: [senderId, receiverId],
      lastMessage: text,
      lastSenderId: senderId,
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await addDoc(
    collection(db, "chats", chatId, "messages"),
    {
      text,
      senderId,
      receiverId,
      createdAt: serverTimestamp(),
    }
  );
};

// Calls the callback with the messages of a chat, oldest first, every time new
// ones arrive.
export const listenMessages = (
  chatId: string,
  callback: (messages: any[]) => void
) => {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(messages);
  });
};

// Calls the callback with a user's chats, most recently active first. The query
// runs on the server so only the chats of that user are loaded.
export const listenChats = (
  uid: string,
  callback: (chats: any[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, "chats"),
    where("users", "array-contains", uid),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const chats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(chats);
    },
    onError
  );
};

// Records that a user has opened a chat, which clears its unread badge.
export const markChatRead = async (chatId: string, uid: string) => {
  await updateDoc(
    doc(db, "chats", chatId),
    new FieldPath("lastReadAt", uid),
    serverTimestamp()
  );
};