// FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection(...).get()) to align with the application's Firebase setup.
import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { Kudo, AnonymousFeedback } from '../types';

export const getKudos = async (limitCount: number = 20): Promise<Kudo[]> => {
    // FIX: Use modular 'collection' and 'query' functions.
    const kudosCol = db.collection('kudos');
    const q = kudosCol.orderBy('createdAt', 'desc').limit(limitCount);
    // FIX: Use modular 'getDocs' function.
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kudo));
};

export const addKudo = async (kudoData: Omit<Kudo, 'id' | 'createdAt'>): Promise<void> => {
    // FIX: Use modular 'addDoc' and 'collection' functions.
    await db.collection('kudos').add({
        ...kudoData,
        // FIX: Use modular 'Timestamp' from named imports.
        createdAt: firebase.firestore.Timestamp.now(),
    });
    // Notification is now handled by a cloud function.
};

export const getAnonymousFeedback = async (): Promise<AnonymousFeedback[]> => {
    // FIX: Use modular 'collection' and 'query' functions.
    const feedbackCol = db.collection('anonymousFeedback');
    const q = feedbackCol.orderBy('createdAt', 'desc');
    // FIX: Use modular 'getDocs' function.
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnonymousFeedback));
};

export const addAnonymousFeedback = async (message: string, category: AnonymousFeedback['category']): Promise<void> => {
    // FIX: Use modular 'addDoc' and 'collection' functions.
    await db.collection('anonymousFeedback').add({
        message,
        category,
        // FIX: Use modular 'Timestamp' from named imports.
        createdAt: firebase.firestore.Timestamp.now(),
    });
};