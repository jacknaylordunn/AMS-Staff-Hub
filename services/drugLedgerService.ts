import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { ControlledDrugLedgerEntry } from '../types';

export const getLedgerEntries = (callback: (entries: ControlledDrugLedgerEntry[]) => void): () => void => {
    const ledgerCol = db.collection('controlledDrugLedger');
    const q = ledgerCol.orderBy('timestamp', 'desc');

    return q.onSnapshot((snapshot) => {
        const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ControlledDrugLedgerEntry));
        callback(entries);
    });
};

export const addLedgerEntry = async (entryData: Omit<ControlledDrugLedgerEntry, 'id' | 'timestamp'>): Promise<void> => {
    await db.collection('controlledDrugLedger').add({
        ...entryData,
        timestamp: firebase.firestore.Timestamp.now(),
    });
};