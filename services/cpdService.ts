// FIX: The errors indicate members are not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { CPDEntry } from '../types';

export const getCPDEntriesForUser = async (userId: string): Promise<CPDEntry[]> => {
    const cpdCol = firestore.collection(db, 'cpd');
    // Simplified query to avoid composite index. Sorting is now done client-side.
    const q = firestore.query(cpdCol, firestore.where('userId', '==', userId));
    const snapshot = await firestore.getDocs(q);
    const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CPDEntry));
    
    // Client-side sorting
    return entries.sort((a, b) => b.date.localeCompare(a.date));
};

export const addCPDEntry = async (entryData: Omit<CPDEntry, 'id' | 'createdAt'>): Promise<void> => {
    await firestore.addDoc(firestore.collection(db, 'cpd'), {
        ...entryData,
        createdAt: firestore.Timestamp.now(),
    });
};

export const updateCPDEntry = async (entryId: string, entryData: Partial<Omit<CPDEntry, 'id'>>): Promise<void> => {
    await firestore.updateDoc(firestore.doc(db, 'cpd', entryId), entryData);
};

export const deleteCPDEntry = async (entryId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'cpd', entryId));
    // Note: For a full implementation, you'd also delete the associated file from Firebase Storage if it exists.
};