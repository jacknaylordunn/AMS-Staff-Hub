import { collection, getDocs, addDoc, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Kudo, AnonymousFeedback } from '../types';
import { createNotification } from './notificationService';

export const getKudos = async (limitCount: number = 20): Promise<Kudo[]> => {
    const kudosCol = collection(db, 'kudos');
    const q = query(kudosCol, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kudo));
};

export const addKudo = async (kudoData: Omit<Kudo, 'id' | 'createdAt'>): Promise<void> => {
    await addDoc(collection(db, 'kudos'), {
        ...kudoData,
        createdAt: Timestamp.now(),
    });
    // Notify the recipient
    await createNotification(
        kudoData.to.uid,
        `${kudoData.from.name} sent you kudos!`,
        '/wellbeing'
    );
};

export const getAnonymousFeedback = async (): Promise<AnonymousFeedback[]> => {
    const feedbackCol = collection(db, 'anonymousFeedback');
    const q = query(feedbackCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnonymousFeedback));
};

export const addAnonymousFeedback = async (message: string, category: AnonymousFeedback['category']): Promise<void> => {
    await addDoc(collection(db, 'anonymousFeedback'), {
        message,
        category,
        createdAt: Timestamp.now(),
    });
};