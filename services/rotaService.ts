
import firebase from 'firebase/compat/app';
import { db, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import type { Shift, ShiftSlot, User } from '../types';
import { showToast } from '../components/Toast';

const getShiftStatus = (slots: ShiftSlot[]): Shift['status'] => {
    const totalSlots = slots.length;
    const filledSlots = slots.filter(s => s.assignedStaff).length;
    if (filledSlots === 0) return 'Open';
    if (filledSlots < totalSlots) return 'Partially Assigned';
    return 'Fully Assigned';
};

export const getShiftById = async (shiftId: string): Promise<Shift | null> => {
    const docRef = db.doc(`shifts/${shiftId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as Shift;
};

// Replaces the old listenToShiftsForMonth for more flexibility
export const listenToShiftsForRange = (startDate: Date, endDate: Date, callback: (shifts: Shift[]) => void): () => void => {
    const start = firebase.firestore.Timestamp.fromDate(startDate);
    const end = firebase.firestore.Timestamp.fromDate(endDate);
    const shiftsCol = db.collection('shifts');
    // Query for shifts that start before the end of our range.
    // This will include shifts that start within the range, and shifts that started before but continue into the range.
    const q = shiftsCol.where('start', '<=', end);
    
    const unsubscribe = q.onSnapshot((snapshot) => {
        const shifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift))
            // Client-side filter to remove shifts that ended before our range started.
            .filter(shift => shift.end.toDate() >= startDate);
        callback(shifts);
    }, (error) => {
        console.error("Error listening to rota shifts:", error);
        showToast("Live rota updates may be unavailable.", "error");
    });

    return unsubscribe;
};


export const getShiftsForDateRange = async (startDate: Date, endDate: Date): Promise<Shift[]> => {
    const start = firebase.firestore.Timestamp.fromDate(startDate);
    const end = firebase.firestore.Timestamp.fromDate(endDate);
    const shiftsCol = db.collection('shifts');
    const q = shiftsCol.where('start', '>=', start).where('start', '<=', end).orderBy('start');
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const getShiftsForUser = async (uid: string, year: number, month: number): Promise<Shift[]> => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const shiftsCol = db.collection('shifts');
    const q = shiftsCol.where('allAssignedStaffUids', 'array-contains', uid);
    
    const snapshot = await q.get();
    const allUserShifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
    
    // Client-side filtering for the specified month
    return allUserShifts.filter(shift => {
        const shiftStartDate = shift.start.toDate();
        return shiftStartDate >= start && shiftStartDate < end;
    });
};

export const createShift = async (shiftData: Omit<Shift, 'id'>): Promise<void> => {
    const allAssignedStaffUids = [...new Set(shiftData.slots.map(s => s.assignedStaff?.uid).filter((uid): uid is string => !!uid))];
    const status = getShiftStatus(shiftData.slots);
    await db.collection('shifts').add({ ...shiftData, allAssignedStaffUids, status });
    // Notifications are now handled by a secure cloud function.
};

export const updateShift = async (shiftId: string, shiftData: Partial<Omit<Shift, 'id'>>): Promise<void> => {
    let dataToUpdate = { ...shiftData };

    if (shiftData.slots) {
        dataToUpdate.allAssignedStaffUids = [...new Set(shiftData.slots.map(s => s.assignedStaff?.uid).filter((uid): uid is string => !!uid))];
        dataToUpdate.status = getShiftStatus(shiftData.slots);
    }
    
    await db.doc(`shifts/${shiftId}`).update(dataToUpdate);
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    await db.doc(`shifts/${shiftId}`).delete();
};

export const bidOnShift = async (shiftId: string, slotId: string): Promise<void> => {
    const bidOnShiftFn = httpsCallable(functions, 'bidOnShift');
    await bidOnShiftFn({ shiftId, slotId });
};

export const cancelBidOnShift = async (shiftId: string, slotId: string): Promise<void> => {
    const cancelBidOnShiftFn = httpsCallable(functions, 'cancelBidOnShift');
    await cancelBidOnShiftFn({ shiftId, slotId });
};

export const assignStaffToSlot = async (shiftId: string, slotId: string, staff: { uid: string; name: string; } | null) => {
    const assignStaffFn = httpsCallable(functions, 'assignStaffToShiftSlot');
    await assignStaffFn({ shiftId, slotId, staff });
};


export const createMultipleShifts = async (shiftsData: Omit<Shift, 'id'>[]): Promise<void> => {
    const chunks: Omit<Shift, 'id'>[][] = [];
    for (let i = 0; i < shiftsData.length; i += 499) { // Batch limit is 500
        chunks.push(shiftsData.slice(i, i + 499));
    }

    for (const chunk of chunks) {
        const batch = db.batch();
        const shiftsCol = db.collection('shifts');
        
        chunk.forEach(shiftData => {
            const docRef = shiftsCol.doc();
            const allAssignedStaffUids = shiftData.slots.map(s => s.assignedStaff?.uid).filter((uid): uid is string => !!uid);
            const status = getShiftStatus(shiftData.slots);
            batch.set(docRef, { ...shiftData, allAssignedStaffUids, status });
        });
        
        await batch.commit();
    }
}