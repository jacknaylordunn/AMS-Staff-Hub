import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/functions';

import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCXi3QZphKo0pnyP6IIgS_dVL0rWxpTE5Y",
  authDomain: "aegis-staff-hub.firebaseapp.com",
  projectId: "aegis-staff-hub",
  storageBucket: "aegis-staff-hub.appspot.com",
  messagingSenderId: "645411821335",
  appId: "1:645411821335:web:a3317a2caec51ec55c0952",
  measurementId: "G-1M3EW6SJZL"
};

// Initialize Firebase using compat
const app = firebase.initializeApp(firebaseConfig);

// Initialize services using modular v9 functions
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: multiple tabs open. Some offline features may not be available.');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not available in this browser. App will not work offline.');
    }
});

export default app;
