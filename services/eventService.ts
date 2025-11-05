import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, doc, getDoc } from 'firebase/firestore';
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
    const eventsCol = collection(db, 'events');
    const q = query(eventsCol, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data(), status: getEventStatus(d.data().date) } as EventLog));
}

export const getEventById = async (eventId: string): Promise<EventLog | null> => {
    const docRef = doc(db, 'events', eventId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    const status = getEventStatus(data.date);
    return { id: docSnap.id, ...data, status } as EventLog;
}

export const createEvent = async (eventData: Omit<EventLog, 'id'>): Promise<void> => {
    await addDoc(collection(db, 'events'), eventData);
}
export const updateEvent = async (eventId: string, eventData: Partial<Omit<EventLog, 'id'>>): Promise<void> => {
    await updateDoc(doc(db, 'events', eventId), eventData);
}
export const deleteEvent = async (eventId: string): Promise<void> => {
    await deleteDoc(doc(db, 'events', eventId));
}