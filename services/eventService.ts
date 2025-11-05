// FIX: The errors indicate members are not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { EventLog } from '../types';


const getEventStatus = (eventDateStr: string): EventLog['status'] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = eventDateStr.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);

    if (eventDate.getTime() < today.getTime()) {
        return 'Completed';
    } else if (eventDate.getTime() === today.getTime()) {
        return 'Active';
    } else {
        return 'Upcoming';
    }
};

// Event Functions
export const getEvents = async (): Promise<EventLog[]> => {
    const eventsCol = firestore.collection(db, 'events');
    const q = firestore.query(eventsCol, firestore.orderBy('date', 'desc'));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data(), status: getEventStatus(d.data().date) } as EventLog));
}

export const getEventById = async (eventId: string): Promise<EventLog | null> => {
    const docRef = firestore.doc(db, 'events', eventId);
    const docSnap = await firestore.getDoc(docRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    const status = getEventStatus(data.date);
    return { id: docSnap.id, ...data, status } as EventLog;
}

export const createEvent = async (eventData: Omit<EventLog, 'id'>): Promise<void> => {
    await firestore.addDoc(firestore.collection(db, 'events'), eventData);
}
export const updateEvent = async (eventId: string, eventData: Partial<Omit<EventLog, 'id'>>): Promise<void> => {
    await firestore.updateDoc(firestore.doc(db, 'events', eventId), eventData);
}
export const deleteEvent = async (eventId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'events', eventId));
}