// Shopping cart stored per buyer in Firestore.
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

import { db } from "../../FirebaseConfig";

import { CartItem } from "../types/cart";

const cartCollection = collection(db, "cart");

// Adds a product to the cart, or adds to the quantity of the line that already
// holds the same product, batch, and egg tray size.
export const addToCart = async (item: CartItem) => {
  try {
    const q = query(
      cartCollection,
      where("buyerId", "==", item.buyerId),
      where("productId", "==", item.productId),
      where("batchId", "==", item.batchId)
    );

    const snap = await getDocs(q);

    const variant = (item as any).eggVariant || null;

    const match = snap.docs.find(
      (d) => ((d.data() as any).eggVariant || null) === variant
    );

    if (match) {
      const data = match.data() as any;
      const existingQty = Number(data.quantity) || 1;
      const existingBase = Number(
        data.baseQuantity ?? data.quantity
      );

      const addBase = Number(
        (item as any).baseQuantity ?? item.quantity
      );

      await updateDoc(doc(db, "cart", match.id), {
        quantity: existingQty + item.quantity,
        // Stock is deducted using the base quantity, so it has to grow alongside it.
        baseQuantity: existingBase + addBase,
      });

      return;
    }

    await addDoc(cartCollection, item);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Returns every cart line of a buyer.
export const getCartByBuyer = async (buyerId: string) => {
  try {
    const q = query(cartCollection, where("buyerId", "==", buyerId));
    const snapshot = await getDocs(q);

    const items: any[] = [];
    snapshot.forEach((docSnap) => {
      items.push({
        docId: docSnap.id,
        ...docSnap.data(),
      });
    });

    return items;
  } catch (error) {
    console.log("GET CART ERROR:", error);
    throw error;
  }
};

// Sets the quantity of one cart line. baseQuantity is only written when given.
export const updateCartQuantity = async (
  docId: string,
  quantity: number,
  baseQuantity?: number
) => {
  try {
    const ref = doc(db, "cart", docId);
    await updateDoc(
      ref,
      baseQuantity === undefined ? { quantity } : { quantity, baseQuantity }
    );
  } catch (error) {
    console.log("UPDATE CART ERROR:", error);
    throw error;
  }
};

// Removes one cart line.
export const removeCartItem = async (docId: string) => {
  try {
    const ref = doc(db, "cart", docId);
    await deleteDoc(ref);
  } catch (error) {
    console.log("REMOVE CART ERROR:", error);
    throw error;
  }
};

// Removes the cart lines of a product that was deleted.
export const deleteCartItemsByProductId = async (productId: string) => {
  try {
    const q = query(cartCollection, where("productId", "==", productId));
    const snapshot = await getDocs(q);

    const deletes = snapshot.docs.map((d) => deleteDoc(doc(db, "cart", d.id)));
    await Promise.all(deletes);
  } catch (error) {
    console.log("DELETE CART BY PRODUCT ERROR:", error);
    throw error;
  }
};

// Removes the cart lines of one deleted batch, leaving other batches untouched.
export const deleteCartItemsByBatchId = async (batchId: string) => {
  try {
    const q = query(cartCollection, where("batchId", "==", batchId));
    const snapshot = await getDocs(q);

    const deletes = snapshot.docs.map((d) => deleteDoc(doc(db, "cart", d.id)));
    await Promise.all(deletes);
  } catch (error) {
    console.log("DELETE CART BY BATCH ERROR:", error);
    throw error;
  }
};