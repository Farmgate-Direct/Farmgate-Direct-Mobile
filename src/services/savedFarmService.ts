// Farms that buyers have saved for later.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db }
  from "../../FirebaseConfig";

// Saves a farm for a buyer. Saving the same farm twice is a no-op.
export const saveFarm =
  async (data: any) => {

    const q = query(
      collection(
        db,
        "savedFarms"
      ),
      where(
        "buyerId",
        "==",
        data.buyerId
      ),
      where(
        "farmerId",
        "==",
        data.farmerId
      )
    );

    const snapshot =
      await getDocs(q);

    if (!snapshot.empty) {
      return;
    }

    await addDoc(
      collection(
        db,
        "savedFarms"
      ),
      {
        ...data,
        createdAt:
          Date.now(),
      }
    );
  };

// Removes a farm from a buyer's saved list.
export const unsaveFarm =
  async (
    buyerId: string,
    farmerId: string
  ) => {

    const q = query(
      collection(
        db,
        "savedFarms"
      ),
      where(
        "buyerId",
        "==",
        buyerId
      ),
      where(
        "farmerId",
        "==",
        farmerId
      )
    );

    const snapshot =
      await getDocs(q);

    for (const item of snapshot.docs) {

      await deleteDoc(
        doc(
          db,
          "savedFarms",
          item.id
        )
      );
    }
  };

// Reports whether a buyer has already saved a farm.
export const checkSavedFarm =
  async (
    buyerId: string,
    farmerId: string
  ) => {

    const q = query(
      collection(
        db,
        "savedFarms"
      ),
      where(
        "buyerId",
        "==",
        buyerId
      ),
      where(
        "farmerId",
        "==",
        farmerId
      )
    );

    const snapshot =
      await getDocs(q);

    return !snapshot.empty;
  };

// Returns every farm a buyer has saved.
export const getSavedFarms =
  async (
    buyerId: string
  ) => {

    const q = query(
      collection(
        db,
        "savedFarms"
      ),
      where(
        "buyerId",
        "==",
        buyerId
      )
    );

    const snapshot =
      await getDocs(q);

    return snapshot.docs.map(
      (doc) => ({
        id: doc.id,
        ...doc.data(),
      })
    );
  };