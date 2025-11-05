// FIX: The errors indicate members are not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { ControlledDrugLedgerEntry } from '../types';

export const getLedgerEntries = (callback: (entries: ControlledDrugLedgerEntry[]) => void) => {
    const ledgerCol = firestore.collection(db, 'controlledDrugLedger');
    const q = firestore.query(ledgerCol, firestore.orderBy('timestamp', 'desc'));

    return firestore.onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ControlledDrugLedgerEntry));
        callback(entries);
    });
};

export const addLedgerEntry = async (entryData: Omit<ControlledDrugLedgerEntry, 'id' | 'timestamp'>): Promise<void> => {
    await firestore.addDoc(firestore.collection(db, 'controlledDrugLedger'), {
        ...entryData,
        timestamp: firestore.Timestamp.now(),
    });
};