

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
// FIX: Using compat imports for storage and functions to resolve module errors.
import 'firebase/compat/storage';
import 'firebase/compat/functions';
import 'firebase/compat/messaging';

import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';
// FIX: Removed modular imports for storage and functions as they were causing errors.
// import { getStorage } from 'firebase/storage';
// import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCXi3QZphKo0pnyP6IIgS_dVL0rWxpTE5Y",
  authDomain: "aegis-staff-hub.firebaseapp.com",
  projectId: "aegis-staff-hub",
  storageBucket: "aegis-staff-hub.appspot.com",
  messagingSenderId: "645411821335",
  appId: "1:645411821335:web:a3317a2caec51ec55c0952",
  measurementId: "G-1M3EW6SJZL"
};

// This key is public and is required to identify this web app to the FCM service.
export const VAPID_KEY = 'BDSG-vA0Z6i_8qE2yJVh5Q-3p2N8yFw049xtuBwLqL9e3bY7c3X7z5H7y4J8g6T7q9E3w0C1f0e2Z4n6K8a5G9c';

// Initialize Firebase using compat
const app = firebase.initializeApp(firebaseConfig);

// Initialize services using modular v9 functions for some, and compat for others.
export const auth = getAuth(app);
export const db = getFirestore(app);
// FIX: Use compat version of storage and functions.
export const storage = firebase.storage();
export const functions = firebase.functions();
export const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;


// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: multiple tabs open. Some offline features may not be available.');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not available in this browser. App will not work offline.');
    }
});

export default app;