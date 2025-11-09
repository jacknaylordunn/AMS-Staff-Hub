import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { Notification } from '../types';

// Notification Functions
export const createNotification = async (userId: string, message: string, link?: string) => {
    await firestore.addDoc(firestore.collection(db, 'notifications'), {
        userId,
        message,
        link: link || '',
        read: false,
        createdAt: firestore.Timestamp.now(),
    });
};

export const listenToNotificationsForUser = (userId: string, callback: (notifications: Notification[]) => void): () => void => {
    const notificationsCol = firestore.collection(db, 'notifications');
    const q = firestore.query(notificationsCol,
        firestore.where('userId', '==', userId),
        firestore.orderBy('createdAt', 'desc'),
        firestore.limit(10));
    
    return firestore.onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        callback(notifications);
    });
};

export const getNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    const notificationsCol = firestore.collection(db, 'notifications');
    const q = firestore.query(notificationsCol,
        firestore.where('userId', '==', userId),
        firestore.where('read', '==', false),
        firestore.orderBy('createdAt', 'desc'),
        firestore.limit(10));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    await firestore.updateDoc(firestore.doc(db, 'notifications', notificationId), { read: true });
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
    const notificationsCol = firestore.collection(db, 'notifications');
    const q = firestore.query(notificationsCol,
        firestore.where('userId', '==', userId),
        firestore.where('read', '==', false));
    
    const snapshot = await firestore.getDocs(q);
    
    if (snapshot.empty) {
        return;
    }
    
    const batch = firestore.writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
};
