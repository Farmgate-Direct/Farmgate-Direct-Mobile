import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { db } from "../../FirebaseConfig";
import type { CartItem } from "../types/cart";

const cartCollection = collection(db, "cart");

export const addToCart = async (item: CartItem) => {
  if (!item.variationId || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
    throw new Error("Choose an available product variation and quantity.");
  }

  const snapshot = await getDocs(
    query(
      cartCollection,
      where("buyerId", "==", item.buyerId),
      where("productId", "==", item.productId),
      where("variationId", "==", item.variationId)
    )
  );
  const existing = snapshot.docs[0];

  if (existing) {
    const data = existing.data();
    await updateDoc(doc(db, "cart", existing.id), {
      quantity: Number(data.quantity || 0) + item.quantity,
    });
    return;
  }

  await addDoc(cartCollection, item);
};

export const getCartByBuyer = async (buyerId: string): Promise<CartItem[]> => {
  const snapshot = await getDocs(
    query(cartCollection, where("buyerId", "==", buyerId))
  );
  return snapshot.docs.map((item) => ({
    docId: item.id,
    ...(item.data() as CartItem),
  }));
};

export const updateCartQuantity = async (
  docId: string,
  quantity: number
) => {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("Enter a valid quantity.");
  }
  await updateDoc(doc(db, "cart", docId), { quantity });
};

export const removeCartItem = async (docId: string) => {
  await deleteDoc(doc(db, "cart", docId));
};

export const deleteCartItemsByProductId = async (productId: string) => {
  const farmerId = getAuth().currentUser?.uid;
  if (!farmerId) {
    throw new Error("Your login session has expired. Please login again.");
  }
  const snapshot = await getDocs(
    query(
      cartCollection,
      where("productId", "==", productId),
      where("farmerId", "==", farmerId)
    )
  );
  await Promise.all(
    snapshot.docs.map((item) => deleteDoc(doc(db, "cart", item.id)))
  );
};
