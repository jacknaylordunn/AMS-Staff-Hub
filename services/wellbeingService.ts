import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { Kudo, AnonymousFeedback } from '../types';

export const getKudos = async (limitCount: number = 20): Promise<Kudo[]> => {
    const kudosCol = db.collection('kudos');
    const q = kudosCol.orderBy('createdAt', 'desc').limit(limitCount);
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kudo));
};

export const addKudo = async (kudoData: Omit<Kudo, 'id' | 'createdAt'>): Promise<void> => {
    await db.collection('kudos').add({
        ...kudoData,
        createdAt: firebase.firestore.Timestamp.now(),
    });
    // Notification is now handled by a cloud function.
};

export const getAnonymousFeedback = async (): Promise<AnonymousFeedback[]> => {
    const feedbackCol = db.collection('anonymousFeedback');
    const q = feedbackCol.orderBy('createdAt', 'desc');
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnonymousFeedback));
};

export const addAnonymousFeedback = async (message: string, category: AnonymousFeedback['category']): Promise<void> => {
    await db.collection('anonymousFeedback').add({
        message,
        category,
        createdAt: firebase.firestore.Timestamp.now(),
    });
};