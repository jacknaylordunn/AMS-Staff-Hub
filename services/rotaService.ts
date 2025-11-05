import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, Timestamp, doc, arrayUnion, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { Shift } from '../types';
import { createNotification } from './notificationService';
import { showToast } from '../components/Toast';

// Shift Functions
export const getShiftsForMonth = async (year: number, month: number): Promise<Shift[]> => {
    const start = Timestamp.fromDate(new Date(year, month, 1));
    const end = Timestamp.fromDate(new Date(year, month + 1, 1));
    const shiftsCol = collection(db, 'shifts');
    const q = query(shiftsCol, where('start', '>=', start), where('start', '<', end));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const listenToShiftsForMonth = (year: number, month: number, callback: (shifts: Shift[]) => void): () => void => {
    const start = Timestamp.fromDate(new Date(year, month, 1));
    const end = Timestamp.fromDate(new Date(year, month + 1, 1));
    const shiftsCol = collection(db, 'shifts');
    const q = query(shiftsCol, where('start', '>=', start), where('start', '<', end));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const shifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
        callback(shifts);
    }, (error) => {
        console.error("Error listening to rota shifts:", error);
        showToast("Live rota updates may be unavailable.", "error");
    });

    return unsubscribe;
};

export const getShiftsForDateRange = async (startDate: Date, endDate: Date): Promise<Shift[]> => {
    const start = Timestamp.fromDate(startDate);
    const end = Timestamp.fromDate(endDate);
    const shiftsCol = collection(db, 'shifts');
    const q = query(shiftsCol, where('start', '>=', start), where('start', '<=', end));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const getShiftsForUser = async (uid: string, year: number, month: number): Promise<Shift[]> => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const shiftsCol = collection(db, 'shifts');
    // Simplified query to avoid composite index requirement. Filtering by date is now done client-side.
    const q = query(shiftsCol, where('assignedStaffUids', 'array-contains', uid));
    
    const snapshot = await getDocs(q);
    const allUserShifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
    
    // Client-side filtering for the specified month
    return allUserShifts.filter(shift => {
        const shiftStartDate = shift.start.toDate();
        return shiftStartDate >= start && shiftStartDate < end;
    });
};

export const createShift = async (shiftData: Omit<Shift, 'id'>): Promise<void> => {
    const assignedStaffUids = shiftData.assignedStaff.map(s => s.uid);
    await addDoc(collection(db, 'shifts'), { ...shiftData, assignedStaffUids, bids: [] });

    // Notify assigned staff
    for (const staff of shiftData.assignedStaff) {
        await createNotification(staff.uid, `You have been assigned a new shift: ${shiftData.eventName} on ${shiftData.start.toDate().toLocaleDateString()}`, '/rota');
    }
};

export const updateShift = async (shiftId: string, shiftData: Partial<Omit<Shift, 'id'>>, originalAssignedUids: string[] = []): Promise<void> => {
    const assignedStaffUids = shiftData.assignedStaff?.map(s => s.uid);
    let dataToUpdate: Partial<Shift> = assignedStaffUids ? { ...shiftData, assignedStaffUids } : shiftData;

    // If staff are being assigned, clear any existing bids.
    if (assignedStaffUids && assignedStaffUids.length > 0) {
        dataToUpdate.bids = [];
    }

    await updateDoc(doc(db, 'shifts', shiftId), dataToUpdate as any);

    // Notify newly assigned staff
    const newStaff = shiftData.assignedStaff?.filter(s => !originalAssignedUids.includes(s.uid));
    if (newStaff) {
        for (const staff of newStaff) {
            await createNotification(staff.uid, `You have been assigned to a shift: ${shiftData.eventName} on ${shiftData.start?.toDate().toLocaleDateString()}`, '/rota');
        }
    }
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    await deleteDoc(doc(db, 'shifts', shiftId));
};

export const bidOnShift = async (shiftId: string, user: { uid: string; name: string; }): Promise<void> => {
    const shiftRef = doc(db, 'shifts', shiftId);
    await updateDoc(shiftRef, {
        bids: arrayUnion({
            ...user,
            timestamp: Timestamp.now(),
        })
    });
};

export const cancelBidOnShift = async (shiftId: string, userId: string): Promise<void> => {
    const shiftRef = doc(db, 'shifts', shiftId);
    const shiftSnap = await getDoc(shiftRef);
    if (!shiftSnap.exists()) {
        throw new Error("Shift not found");
    }
    const shiftData = shiftSnap.data() as Shift;
    const newBids = (shiftData.bids || []).filter(bid => bid.uid !== userId);
    await updateDoc(shiftRef, {
        bids: newBids
    });
};