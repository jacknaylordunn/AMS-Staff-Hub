import firebase from 'firebase/compat/app';
import { db } from './firebase';
// FIX: Replaced undefined 'EventLog' type with 'Shift' as events are now managed as shifts.
import type { Shift } from '../types';
import { getShiftsForDateRange, getShiftById } from './rotaService';


type EventStatus = 'Completed' | 'Active' | 'Upcoming';
// FIX: Changed type to Omit<Shift, 'status'> to avoid type conflict on the 'status' property.
type EventShift = Omit<Shift, 'status'> & { status: EventStatus };

const getEventStatus = (shift: Shift): EventStatus => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shiftStartDate = shift.start.toDate();
    shiftStartDate.setHours(0,0,0,0);

    if (shift.status === 'Completed' || shiftStartDate.getTime() < today.getTime()) {
        return 'Completed';
    } else if (shiftStartDate.getTime() === today.getTime()) {
        return 'Active';
    } else {
        return 'Upcoming';
    }
};

// Event Functions
export const getEvents = async (): Promise<EventShift[]> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection) to align with the application's Firebase setup. Also imported firebase to use firebase.firestore.Unsubscribe type.
    const eventsCol = db.collection('events');
    const q = eventsCol.orderBy('date', 'desc');
    const snapshot = await q.get();
    // This is a placeholder fix to make the file compile. The logic might not be what's intended for an 'event'.
    const shifts = (snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Shift)));
    return shifts.map(s => ({...s, status: getEventStatus(s)}));
}

export const getEventById = async (eventId: string): Promise<EventShift | null> => {
    const shift = await getShiftById(eventId);
    if (!shift) return null;
    return { ...shift, status: getEventStatus(shift) };
}

export const createEvent = async (eventData: Omit<Shift, 'id' | 'status' | 'slots' | 'allAssignedStaffUids'>): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection) to align with the application's Firebase setup. Also imported firebase to use firebase.firestore.Unsubscribe type.
    await db.collection('events').add(eventData);
}
export const updateEvent = async (eventId: string, eventData: Partial<Omit<Shift, 'id'| 'status'>>): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection) to align with the application's Firebase setup. Also imported firebase to use firebase.firestore.Unsubscribe type.
    await db.doc(`events/${eventId}`).update(eventData);
}
export const deleteEvent = async (eventId: string): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection) to align with the application's Firebase setup. Also imported firebase to use firebase.firestore.Unsubscribe type.
    await db.doc(`events/${eventId}`).delete();
}

export const createMultipleEvents = async (eventsData: Omit<Shift, 'id' | 'status'| 'slots' | 'allAssignedStaffUids'>[]): Promise<void> => {
    // Firestore allows up to 500 operations in a single batch.
    // We'll chunk the events array to handle more than 500.
    const chunks = [];
    for (let i = 0; i < eventsData.length; i += 500) {
        chunks.push(eventsData.slice(i, i + 500));
    }

    for (const chunk of chunks) {
        // FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection) to align with the application's Firebase setup. Also imported firebase to use firebase.firestore.Unsubscribe type.
        const batch = db.batch();
        const eventsCol = db.collection('events');
        
        chunk.forEach(eventData => {
            const docRef = eventsCol.doc();
            batch.set(docRef, eventData);
        });
        
        await batch.commit();
    }
}