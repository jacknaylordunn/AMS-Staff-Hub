// FIX: The errors indicate members are not exported. Using namespace imports `* as ...` to fix module resolution issues.
import * as firebaseApp from 'firebase/app';
// import { getAnalytics } from 'firebase/analytics';
import * as firebaseAuth from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import * as firebaseStorage from 'firebase/storage';

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
const app = firebaseApp.initializeApp(firebaseConfig);

// Initialize services
// getAnalytics(app);
export const auth = firebaseAuth.getAuth(app);
export const db = firestore.getFirestore(app);
export const storage = firebaseStorage.getStorage(app);

// Enable offline persistence
firestore.enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Firestore persistence failed: multiple tabs open.');
    } else if (err.code == 'unimplemented') {
        console.warn('Firestore persistence not available in this browser.');
    }
});

export default app;