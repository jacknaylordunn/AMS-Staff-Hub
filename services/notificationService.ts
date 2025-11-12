import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { Notification } from '../types';

// Notification Functions
export const createNotification = async (userId: string, message: string, link?: string) => {
    await db.collection('notifications').add({
        userId,
        message,
        link: link || '',
        read: false,
        createdAt: firebase.firestore.Timestamp.now(),
    });
};

export const listenToNotificationsForUser = (userId: string, callback: (notifications: Notification[]) => void): () => void => {
    const notificationsCol = db.collection('notifications');
    const q = notificationsCol
        .where('userId', '==', userId)
        .limit(20);
    
    return q.onSnapshot((snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        // Sort client-side to avoid needing a composite index
        notifications.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        callback(notifications.slice(0, 10)); // Apply limit after sorting
    });
};

export const getNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    const notificationsCol = db.collection('notifications');
    const q = notificationsCol
        .where('userId', '==', userId)
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(10);
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    await db.doc(`notifications/${notificationId}`).update({ read: true });
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
    const notificationsCol = db.collection('notifications');
    const q = notificationsCol
        .where('userId', '==', userId)
        .where('read', '==', false);
    
    const snapshot = await q.get();
    
    if (snapshot.empty) {
        return;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
};