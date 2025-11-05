// FIX: The errors indicate members are not exported. Using namespace import `* as ...` to fix module resolution issues.
// FIX: Switched to modular imports as `initializeApp` is not available on the namespace. This is the standard for Firebase v9+.
// FIX: Corrected imports to use modular v9 syntax to resolve initializeApp error.
import { initializeApp } from 'firebase/app';
// import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration embedded as per request to resolve environment variable issues.
const firebaseConfig = {
  apiKey: "AIzaSyCXi3QZphKo0pnyP6IIgS_dVL0rWxpTE5Y",
  authDomain: "aegis-staff-hub.firebaseapp.com",
  projectId: "aegis-staff-hub",
  storageBucket: "aegis-staff-hub.appspot.com",
  messagingSenderId: "645411821335",
  appId: "1:645411821335:web:a3317a2caec51ec55c0952",
  measurementId: "G-1M3EW6SJZL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
// getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Firestore persistence failed: multiple tabs open.');
    } else if (err.code == 'unimplemented') {
        console.warn('Firestore persistence not available in this browser.');
    }
});

export default app;