import { collection, getDocs, addDoc, query, orderBy, limit, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Announcement } from '../types';

// Announcement Functions
export const getAnnouncements = async (): Promise<Announcement[]> => {
    const snapshot = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(20)));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
}

export const sendAnnouncementToAllUsers = async (message: string, sender: { uid: string; name: string; }): Promise<void> => {
    const announcementData = {
        message,
        sentBy: sender,
        createdAt: Timestamp.now(),
    };
    // 1. Save the announcement to its own collection for history
    await addDoc(collection(db, 'announcements'), announcementData);

    // 2. Create notifications for all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);

    usersSnapshot.docs.forEach(userDoc => {
        const notificationsRef = collection(db, 'notifications');
        const truncatedMessage = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        batch.set(notificationsRef.doc(), {
            userId: userDoc.id,
            message: `New Hub Announcement: "${truncatedMessage}"`,
            read: false,
            createdAt: Timestamp.now(),
            link: '/dashboard'
        });
    });
    
    await batch.commit();
}
