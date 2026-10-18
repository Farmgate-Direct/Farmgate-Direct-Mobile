// Firebase setup shared by the whole app: auth, Firestore, and storage.
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyA_3_BKzXysh7XBPGnqGpJtf3KXAGBEhno",
  authDomain: "farmgate-new.firebaseapp.com",
  projectId: "farmgate-new",
  storageBucket: "farmgate-new.firebasestorage.app",
  messagingSenderId: "493241053567",
  appId: "1:493241053567:web:4052283b82a71fffed6a4a"
};

// Initializing twice throws, so reuse the existing instance after a fast refresh.
export const app =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    // AsyncStorage keeps the user signed in between app launches.
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // A fast refresh already initialized auth, so reuse it.
    return getAuth(app);
  }
})();

export const db = getFirestore(app);

export const storage = getStorage(app);
