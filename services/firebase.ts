

import firebase from "firebase/compat/app";
import "firebase/compat/analytics";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";

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

// FIX: Changed to Firebase v8/compat initialization syntax to resolve import errors.
const app = firebase.initializeApp(firebaseConfig);

// Initialize services
firebase.analytics();
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();

// Enable offline persistence
// FIX: Changed to v8/compat syntax for enabling persistence.
db.enablePersistence().catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Firestore persistence failed: multiple tabs open.');
    } else if (err.code == 'unimplemented') {
        console.warn('Firestore persistence not available in this browser.');
    }
});

export default app;