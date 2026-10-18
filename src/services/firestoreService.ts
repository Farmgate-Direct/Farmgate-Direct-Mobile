// Writes a user profile document.
import { doc, setDoc } from "firebase/firestore";

import { db } from "../../FirebaseConfig";

// Saves profile data for one user, replacing whatever was stored before.
export const saveUserToFirestore = async (
  uid: string,
  data: any
) => {
  await setDoc(doc(db, "users", uid), data);
};