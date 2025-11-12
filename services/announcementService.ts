import { db, functions } from './firebase';
import type { Announcement } from '../types';

export type AnnouncementTarget =
    | { type: 'all' }
    | { type: 'roles', roles: string[] }
    | { type: 'event', eventName: string };

// Announcement Functions
export const getAnnouncements = async (): Promise<Announcement[]> => {
    const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').limit(20).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
}

export const sendAnnouncement = async (message: string, target: AnnouncementTarget, link?: string): Promise<void> => {
    // This now calls the cloud function with targeting information. The sender is determined by the authenticated user in the cloud function context.
    const sendAnnouncementFn = functions.httpsCallable('sendAnnouncement');
    await sendAnnouncementFn({ message, target, link });
}

export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
    await db.doc(`announcements/${announcementId}`).delete();
};