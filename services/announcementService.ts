import { collection, getDocs, addDoc, query, orderBy, limit, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Announcement } from '../types';
import { getUsers } from './userService';

// Announcement Functions
export const getAnnouncements = async (): Promise<Announcement[]> => {
    const snapshot = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(20)));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
}

export const sendAnnouncementToAllUsers = async (message: string, sender: { uid: string; name: string; }, link?: string): Promise<void> => {
    const announcementData = {
        message,
        sentBy: sender,
        createdAt: Timestamp.now(),
    };
    // 1. Save the announcement to its own collection for history
    await addDoc(collection(db, 'announcements'), announcementData);

    // 2. Create notifications for all users
    const users = await getUsers();
    const batch = writeBatch(db);

    users.forEach(user => {
        const notificationsRef = collection(db, 'notifications');
        const truncatedMessage = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        // Create a new doc with a random ID
        // FIX: 'doc' was not defined. It is now imported from 'firebase/firestore'.
        const newNotifRef = doc(notificationsRef);
        batch.set(newNotifRef, {
            userId: user.uid,
            message: `New Hub Announcement: "${truncatedMessage}"`,
            read: false,
            createdAt: Timestamp.now(),
            link: link || '/dashboard'
        });
    });
    
    await batch.commit();
}