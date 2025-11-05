import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { ControlledDrugLedgerEntry } from '../types';

export const getLedgerEntries = (callback: (entries: ControlledDrugLedgerEntry[]) => void) => {
    const ledgerCol = collection(db, 'controlledDrugLedger');
    const q = query(ledgerCol, orderBy('timestamp', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ControlledDrugLedgerEntry));
        callback(entries);
    });
};

export const addLedgerEntry = async (entryData: Omit<ControlledDrugLedgerEntry, 'id' | 'timestamp'>): Promise<void> => {
    await addDoc(collection(db, 'controlledDrugLedger'), {
        ...entryData,
        timestamp: Timestamp.now(),
    });
};
