// Delivery addresses saved by buyers.
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

import { db }
  from "../../FirebaseConfig";

// Saves a new address for a buyer.
export const addAddress =
  async (
    address: any
  ) => {

    try {

      // A buyer may only have one default address, so clear the old one first.
      if (
        address.isDefault
      ) {

        const q =
          query(
            collection(
              db,
              "addresses"
            ),
            where(
              "userId",
              "==",
              address.userId
            ),
            where(
              "isDefault",
              "==",
              true
            )
          );

        const snapshot =
          await getDocs(q);

        for (const item of snapshot.docs) {

          await updateDoc(
            doc(
              db,
              "addresses",
              item.id
            ),
            {
              isDefault: false,
            }
          );
        }
      }

      await addDoc(
        collection(
          db,
          "addresses"
        ),
        {
          ...address,
          createdAt:
            new Date(),
        }
      );

    } catch (error) {

      console.log(error);

      throw error;
    }
  };

// Returns every address of a buyer. Returns an empty list when the read fails.
export const getUserAddresses =
  async (
    userId: string
  ) => {

    try {

      const q =
        query(
          collection(
            db,
            "addresses"
          ),
          where(
            "userId",
            "==",
            userId
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

    } catch (error) {

      console.log(error);

      return [];
    }
  };

// Moves the default flag onto one address, clearing it from the old default.
export const setDefaultAddress =
  async (
    userId: string,
    addressId: string
  ) => {

    try {

      const q =
        query(
          collection(
            db,
            "addresses"
          ),
          where(
            "userId",
            "==",
            userId
          ),
          where(
            "isDefault",
            "==",
            true
          )
        );

      const snapshot =
        await getDocs(q);

      for (const item of snapshot.docs) {

        await updateDoc(
          doc(
            db,
            "addresses",
            item.id
          ),
          {
            isDefault: false,
          }
        );
      }

      await updateDoc(
        doc(
          db,
          "addresses",
          addressId
        ),
        {
          isDefault: true,
        }
      );

    } catch (error) {

      console.log(error);

      throw error;
    }
  };

// Removes one address from the buyer's list.
export const deleteAddress =
  async (
    addressId: string
  ) => {

    try {

      await deleteDoc(
        doc(
          db,
          "addresses",
          addressId
        )
      );

    } catch (error) {

      console.log(error);

      throw error;
    }
  };