import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { Kudo, AnonymousFeedback } from '../types';

export const getKudos = async (limitCount: number = 20): Promise<Kudo[]> => {
    const kudosCol = firestore.collection(db, 'kudos');
    const q = firestore.query(kudosCol, firestore.orderBy('createdAt', 'desc'), firestore.limit(limitCount));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kudo));
};

export const addKudo = async (kudoData: Omit<Kudo, 'id' | 'createdAt'>): Promise<void> => {
    await firestore.addDoc(firestore.collection(db, 'kudos'), {
        ...kudoData,
        createdAt: firestore.Timestamp.now(),
    });
    // Notification is now handled by a cloud function.
};

export const getAnonymousFeedback = async (): Promise<AnonymousFeedback[]> => {
    const feedbackCol = firestore.collection(db, 'anonymousFeedback');
    const q = firestore.query(feedbackCol, firestore.orderBy('createdAt', 'desc'));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnonymousFeedback));
};

export const addAnonymousFeedback = async (message: string, category: AnonymousFeedback['category']): Promise<void> => {
    await firestore.addDoc(firestore.collection(db, 'anonymousFeedback'), {
        message,
        category,
        createdAt: firestore.Timestamp.now(),
    });
};