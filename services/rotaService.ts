import firebase from 'firebase/compat/app';
import { db, functions } from './firebase';
import type { Shift, ShiftSlot, User } from '../types';
import { createNotification } from './notificationService';
import { showToast } from '../components/Toast';

const getShiftStatus = (slots: ShiftSlot[]): Shift['status'] => {
    const totalSlots = slots.length;
    const filledSlots = slots.filter(s => s.assignedStaff).length;
    if (filledSlots === 0) return 'Open';
    if (filledSlots < totalSlots) return 'Partially Assigned';
    return 'Fully Assigned';
};

export const getShiftById = async (shiftId: string): Promise<Shift | null> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const docRef = db.doc(`shifts/${shiftId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as Shift;
};

// Shift Functions
export const getShiftsForMonth = async (year: number, month: number): Promise<Shift[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const start = firebase.firestore.Timestamp.fromDate(new Date(year, month, 1));
    const end = firebase.firestore.Timestamp.fromDate(new Date(year, month + 1, 1));
    const shiftsCol = db.collection('shifts');
    const q = shiftsCol.where('start', '>=', start).where('start', '<', end);
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const listenToShiftsForMonth = (year: number, month: number, callback: (shifts: Shift[]) => void): () => void => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const start = firebase.firestore.Timestamp.fromDate(new Date(year, month, 1));
    const end = firebase.firestore.Timestamp.fromDate(new Date(year, month + 1, 1));
    const shiftsCol = db.collection('shifts');
    const q = shiftsCol.where('start', '>=', start).where('start', '<', end);
    
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const unsubscribe = q.onSnapshot((snapshot) => {
        const shifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
        callback(shifts);
    }, (error) => {
        console.error("Error listening to rota shifts:", error);
        showToast("Live rota updates may be unavailable.", "error");
    });

    return unsubscribe;
};

export const getShiftsForDateRange = async (startDate: Date, endDate: Date): Promise<Shift[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
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
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
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
    const allAssignedStaffUids = shiftData.slots.map(s => s.assignedStaff?.uid).filter((uid): uid is string => !!uid);
    const status = getShiftStatus(shiftData.slots);
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await db.collection('shifts').add({ ...shiftData, allAssignedStaffUids, status });

    // Notify assigned staff
    for (const slot of shiftData.slots) {
        if (slot.assignedStaff) {
             await createNotification(slot.assignedStaff.uid, `You have been assigned a new shift: ${shiftData.eventName} on ${shiftData.start.toDate().toLocaleDateString()}`, '/rota');
        }
    }
};

export const updateShift = async (shiftId: string, shiftData: Partial<Omit<Shift, 'id'>>): Promise<void> => {
    let dataToUpdate = { ...shiftData };

    if (shiftData.slots) {
        dataToUpdate.allAssignedStaffUids = shiftData.slots.map(s => s.assignedStaff?.uid).filter((uid): uid is string => !!uid);
        dataToUpdate.status = getShiftStatus(shiftData.slots);
    }
    
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await db.doc(`shifts/${shiftId}`).update(dataToUpdate);
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await db.doc(`shifts/${shiftId}`).delete();
};

export const bidOnShift = async (shiftId: string, slotId: string): Promise<void> => {
    const bidOnShiftFn = functions.httpsCallable('bidOnShift');
    await bidOnShiftFn({ shiftId, slotId });
};

export const cancelBidOnShift = async (shiftId: string, slotId: string): Promise<void> => {
    const cancelBidOnShiftFn = functions.httpsCallable('cancelBidOnShift');
    await cancelBidOnShiftFn({ shiftId, slotId });
};

export const assignStaffToSlot = async (shiftId: string, slotId: string, staff: { uid: string; name: string; } | null) => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const shiftRef = db.doc(`shifts/${shiftId}`);
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await db.runTransaction(async (transaction) => {
        const shiftSnap = await transaction.get(shiftRef);
        if (!shiftSnap.exists) throw new Error("Shift not found");

        const shiftData = shiftSnap.data() as Shift;
        const slotIndex = shiftData.slots.findIndex(s => s.id === slotId);
        if (slotIndex === -1) throw new Error("Slot not found");

        // Assign staff (or null to unassign) and clear bids for the slot
        shiftData.slots[slotIndex].assignedStaff = staff;
        if (staff) {
            shiftData.slots[slotIndex].bids = [];
        }

        // Recalculate top-level properties
        const allAssignedStaffUids = shiftData.slots.map(s => s.assignedStaff?.uid).filter((uid): uid is string => !!uid);
        const status = getShiftStatus(shiftData.slots);
        
        transaction.update(shiftRef, { 
            slots: shiftData.slots,
            allAssignedStaffUids,
            status 
        });
    });

    // Send notification outside the transaction
    if (staff) {
        const shift = await getShiftById(shiftId);
        if(shift) {
            await createNotification(staff.uid, `You have been assigned to the shift: ${shift.eventName} on ${shift.start.toDate().toLocaleDateString()}`, `/brief/${shiftId}`);
        }
    }
};


export const createMultipleShifts = async (shiftsData: Omit<Shift, 'id'>[]): Promise<void> => {
    const chunks: Omit<Shift, 'id'>[][] = [];
    for (let i = 0; i < shiftsData.length; i += 500) {
        chunks.push(shiftsData.slice(i, i + 500));
    }

    for (const chunk of chunks) {
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
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