import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { EventLog } from '../types';

// Event Functions
export const getEvents = async (): Promise<EventLog[]> => {
    const eventsCol = collection(db, 'events');
    const q = query(eventsCol, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EventLog));
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
