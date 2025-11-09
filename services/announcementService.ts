import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { Announcement } from '../types';
import { getUsers } from './userService';
import { createNotification } from './notificationService';

// Announcement Functions
export const getAnnouncements = async (): Promise<Announcement[]> => {
    const snapshot = await firestore.getDocs(firestore.query(firestore.collection(db, 'announcements'), firestore.orderBy('createdAt', 'desc'), firestore.limit(20)));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
}

export const sendAnnouncementToAllUsers = async (message: string, sender: { uid: string; name: string; }, link?: string): Promise<void> => {
    const announcementData = {
        message,
        sentBy: sender,
        createdAt: firestore.Timestamp.now(),
    };
    // 1. Save the announcement to its own collection for history
    await firestore.addDoc(firestore.collection(db, 'announcements'), announcementData);

    // 2. Create notifications for all users
    const users = await getUsers();
    
    // Create notifications in batches to avoid overwhelming Firestore
    const promises = [];
    for (let i = 0; i < users.length; i += 500) {
        const batch = firestore.writeBatch(db);
        const userChunk = users.slice(i, i + 500);
        userChunk.forEach(user => {
            const notificationsRef = firestore.collection(db, 'notifications');
            const truncatedMessage = message.substring(0, 50) + (message.length > 50 ? '...' : '');
            // Create a new doc with a random ID
            const newNotifRef = firestore.doc(notificationsRef);
            batch.set(newNotifRef, {
                userId: user.uid,
                message: `New Hub Announcement: "${truncatedMessage}"`,
                read: false,
                createdAt: firestore.Timestamp.now(),
                link: link || '/dashboard'
            });
        });
        promises.push(batch.commit());
    }
    
    await Promise.all(promises);
}

export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'announcements', announcementId));
};