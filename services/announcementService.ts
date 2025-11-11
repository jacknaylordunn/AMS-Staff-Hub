import { db, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import type { Announcement } from '../types';

export type AnnouncementTarget =
    | { type: 'all' }
    | { type: 'roles', roles: string[] }
    | { type: 'event', eventName: string };

// Announcement Functions
export const getAnnouncements = async (): Promise<Announcement[]> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax to match the rest of the application's Firebase setup.
    const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').limit(20).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
}

export const sendAnnouncement = async (message: string, target: AnnouncementTarget, link?: string): Promise<void> => {
    // This now calls the cloud function with targeting information. The sender is determined by the authenticated user in the cloud function context.
    const sendAnnouncementFn = httpsCallable(functions, 'sendAnnouncement');
    await sendAnnouncementFn({ message, target, link });
}

export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax to match the rest of the application's Firebase setup.
    await db.doc(`announcements/${announcementId}`).delete();
};