import * as firestore from 'firebase/firestore';
import { db } from './firebase';
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
    const docRef = firestore.doc(db, 'shifts', shiftId);
    const docSnap = await firestore.getDoc(docRef);
    if (!docSnap.exists()) {
        return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as Shift;
};

// Shift Functions
export const getShiftsForMonth = async (year: number, month: number): Promise<Shift[]> => {
    const start = firestore.Timestamp.fromDate(new Date(year, month, 1));
    const end = firestore.Timestamp.fromDate(new Date(year, month + 1, 1));
    const shiftsCol = firestore.collection(db, 'shifts');
    const q = firestore.query(shiftsCol, firestore.where('start', '>=', start), firestore.where('start', '<', end));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const listenToShiftsForMonth = (year: number, month: number, callback: (shifts: Shift[]) => void): () => void => {
    const start = firestore.Timestamp.fromDate(new Date(year, month, 1));
    const end = firestore.Timestamp.fromDate(new Date(year, month + 1, 1));
    const shiftsCol = firestore.collection(db, 'shifts');
    const q = firestore.query(shiftsCol, firestore.where('start', '>=', start), firestore.where('start', '<', end));
    
    const unsubscribe = firestore.onSnapshot(q, (snapshot) => {
        const shifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
        callback(shifts);
    }, (error) => {
        console.error("Error listening to rota shifts:", error);
        showToast("Live rota updates may be unavailable.", "error");
    });

    return unsubscribe;
};

export const getShiftsForDateRange = async (startDate: Date, endDate: Date): Promise<Shift[]> => {
    const start = firestore.Timestamp.fromDate(startDate);
    const end = firestore.Timestamp.fromDate(endDate);
    const shiftsCol = firestore.collection(db, 'shifts');
    const q = firestore.query(shiftsCol, firestore.where('start', '>=', start), firestore.where('start', '<=', end), firestore.orderBy('start'));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const getShiftsForUser = async (uid: string, year: number, month: number): Promise<Shift[]> => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const shiftsCol = firestore.collection(db, 'shifts');
    const q = firestore.query(shiftsCol, firestore.where('allAssignedStaffUids', 'array-contains', uid));
    
    const snapshot = await firestore.getDocs(q);
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
    await firestore.addDoc(firestore.collection(db, 'shifts'), { ...shiftData, allAssignedStaffUids, status });

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
    
    await firestore.updateDoc(firestore.doc(db, 'shifts', shiftId), dataToUpdate);
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'shifts', shiftId));
};

export const bidOnShift = async (shiftId: string, slotId: string, user: { uid: string; name: string; }): Promise<void> => {
    const shiftRef = firestore.doc(db, 'shifts', shiftId);
    const shiftSnap = await firestore.getDoc(shiftRef);
    if (!shiftSnap.exists()) throw new Error("Shift not found");

    const shiftData = shiftSnap.data() as Shift;
    const slotIndex = shiftData.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) throw new Error("Slot not found");

    shiftData.slots[slotIndex].bids.push({ ...user, timestamp: firestore.Timestamp.now() });

    await firestore.updateDoc(shiftRef, { slots: shiftData.slots });
};

export const cancelBidOnShift = async (shiftId: string, slotId: string, userId: string): Promise<void> => {
    const shiftRef = firestore.doc(db, 'shifts', shiftId);
    const shiftSnap = await firestore.getDoc(shiftRef);
    if (!shiftSnap.exists()) throw new Error("Shift not found");
    
    const shiftData = shiftSnap.data() as Shift;
    const slotIndex = shiftData.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) throw new Error("Slot not found");

    shiftData.slots[slotIndex].bids = shiftData.slots[slotIndex].bids.filter(bid => bid.uid !== userId);

    await firestore.updateDoc(shiftRef, { slots: shiftData.slots });
};

export const assignStaffToSlot = async (shiftId: string, slotId: string, staff: { uid: string; name: string; }) => {
    const shiftRef = firestore.doc(db, 'shifts', shiftId);
    await firestore.runTransaction(db, async (transaction) => {
        const shiftSnap = await transaction.get(shiftRef);
        if (!shiftSnap.exists()) throw new Error("Shift not found");

        const shiftData = shiftSnap.data() as Shift;
        const slotIndex = shiftData.slots.findIndex(s => s.id === slotId);
        if (slotIndex === -1) throw new Error("Slot not found");

        // Assign staff and clear bids for the slot
        shiftData.slots[slotIndex].assignedStaff = staff;
        shiftData.slots[slotIndex].bids = [];

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
    const shift = await getShiftById(shiftId);
    if(shift) {
        await createNotification(staff.uid, `You have been assigned to the shift: ${shift.eventName} on ${shift.start.toDate().toLocaleDateString()}`, `/brief/${shiftId}`);
    }
};


export const createMultipleShifts = async (shiftsData: Omit<Shift, 'id'>[]): Promise<void> => {
    const chunks: Omit<Shift, 'id'>[][] = [];
    for (let i = 0; i < shiftsData.length; i += 500) {
        chunks.push(shiftsData.slice(i, i + 500));
    }

    for (const chunk of chunks) {
        const batch = firestore.writeBatch(db);
        const shiftsCol = firestore.collection(db, 'shifts');
        
        chunk.forEach(shiftData => {
            const docRef = firestore.doc(shiftsCol);
            const allAssignedStaffUids = shiftData.slots.map(s => s.assignedStaff?.uid).filter((uid): uid is string => !!uid);
            const status = getShiftStatus(shiftData.slots);
            batch.set(docRef, { ...shiftData, allAssignedStaffUids, status });
        });
        
        await batch.commit();
    }
}