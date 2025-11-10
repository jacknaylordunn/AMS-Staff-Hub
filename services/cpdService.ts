import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { CPDEntry } from '../types';

export const getCPDEntriesForUser = async (userId: string): Promise<CPDEntry[]> => {
    // FIX: Replaced modular Firestore imports and function calls with their compat equivalents (e.g., db.collection, firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const cpdCol = db.collection('cpd');
    // Simplified query to avoid composite index. Sorting is now done client-side.
    const q = cpdCol.where('userId', '==', userId);
    const snapshot = await q.get();
    const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CPDEntry));
    
    // Client-side sorting
    return entries.sort((a, b) => b.date.localeCompare(a.date));
};

export const addCPDEntry = async (entryData: Omit<CPDEntry, 'id' | 'createdAt'>): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with their compat equivalents (e.g., db.collection, firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await db.collection('cpd').add({
        ...entryData,
        createdAt: firebase.firestore.Timestamp.now(),
    });
};

export const updateCPDEntry = async (entryId: string, entryData: Partial<Omit<CPDEntry, 'id'>>): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with their compat equivalents (e.g., db.collection, firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await db.doc(`cpd/${entryId}`).update(entryData);
};

export const deleteCPDEntry = async (entryId: string): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with their compat equivalents (e.g., db.collection, firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await db.doc(`cpd/${entryId}`).delete();
    // Note: For a full implementation, you'd also delete the associated file from Firebase Storage if it exists.
};