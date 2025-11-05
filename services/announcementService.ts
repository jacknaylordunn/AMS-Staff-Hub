// FIX: The errors indicate members are not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { Announcement } from '../types';
import { getUsers } from './userService';

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
    const batch = firestore.writeBatch(db);

    users.forEach(user => {
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
    
    await batch.commit();
}