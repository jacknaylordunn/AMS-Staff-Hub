// FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection) and types (e.g., firebase.firestore.Unsubscribe) to align with the application's Firebase setup.
import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { ControlledDrugLedgerEntry } from '../types';

// FIX: Corrected return type for onSnapshot listener from 'firebase.firestore.Unsubscribe' to '() => void'.
export const getLedgerEntries = (callback: (entries: ControlledDrugLedgerEntry[]) => void): () => void => {
    // FIX: Use modular 'collection' and 'query' functions.
    const ledgerCol = db.collection('controlledDrugLedger');
    const q = ledgerCol.orderBy('timestamp', 'desc');

    // FIX: Use modular 'onSnapshot' function.
    return q.onSnapshot((snapshot) => {
        const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ControlledDrugLedgerEntry));
        callback(entries);
    });
};

export const addLedgerEntry = async (entryData: Omit<ControlledDrugLedgerEntry, 'id' | 'timestamp'>): Promise<void> => {
    // FIX: Use modular 'addDoc' and 'collection' functions.
    await db.collection('controlledDrugLedger').add({
        ...entryData,
        // FIX: Use modular 'Timestamp' from named imports.
        timestamp: firebase.firestore.Timestamp.now(),
    });
};
