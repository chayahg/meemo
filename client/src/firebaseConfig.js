import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDOjDr0sTk_SJZVNCJ-vhKkBwf8rpFPtf0",
  authDomain: "mee-mo.firebaseapp.com",
  projectId: "mee-mo",
  storageBucket: "mee-mo.firebasestorage.app",
  messagingSenderId: "931918989218",
  appId: "1:931918989218:web:9e291fb6b2219ce3fe94fb",
  measurementId: "G-942T5WWBV5",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export { app, analytics };
