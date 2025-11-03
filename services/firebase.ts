
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCXi3QZphKo0pnyP6IIgS_dVL0rWxpTE5Y",
  authDomain: "aegis-staff-hub.firebaseapp.com",
  projectId: "aegis-staff-hub",
  storageBucket: "aegis-staff-hub.firebasestorage.app",
  messagingSenderId: "645411821335",
  appId: "1:645411821335:web:a3317a2caec51ec55c0952",
  measurementId: "G-1M3EW6SJZL"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
