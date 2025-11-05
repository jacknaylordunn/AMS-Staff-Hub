import { collection, addDoc, getDocs, updateDoc, query, where, orderBy, limit, Timestamp, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Notification } from '../types';

// Notification Functions
export const createNotification = async (userId: string, message: string, link?: string) => {
    await addDoc(collection(db, 'notifications'), {
        userId,
        message,
        link: link || '',
        read: false,
        createdAt: Timestamp.now(),
    });
};

export const getNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    const notificationsCol = collection(db, 'notifications');
    const q = query(notificationsCol,
        where('userId', '==', userId),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(10));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
};
