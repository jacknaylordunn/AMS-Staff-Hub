import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { CPDEntry } from '../types';

export const getCPDEntriesForUser = async (userId: string): Promise<CPDEntry[]> => {
    const cpdCol = collection(db, 'cpd');
    const q = query(cpdCol, where('userId', '==', userId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CPDEntry));
};

export const addCPDEntry = async (entryData: Omit<CPDEntry, 'id' | 'createdAt'>): Promise<void> => {
    await addDoc(collection(db, 'cpd'), {
        ...entryData,
        createdAt: Timestamp.now(),
    });
};

export const updateCPDEntry = async (entryId: string, entryData: Partial<Omit<CPDEntry, 'id'>>): Promise<void> => {
    await updateDoc(doc(db, 'cpd', entryId), entryData);
};

export const deleteCPDEntry = async (entryId: string): Promise<void> => {
    await deleteDoc(doc(db, 'cpd', entryId));
    // Note: For a full implementation, you'd also delete the associated file from Firebase Storage if it exists.
};