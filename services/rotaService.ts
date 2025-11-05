import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, Timestamp, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Shift } from '../types';
import { createNotification } from './notificationService';

// Shift Functions
export const getShiftsForMonth = async (year: number, month: number): Promise<Shift[]> => {
    const start = Timestamp.fromDate(new Date(year, month, 1));
    const end = Timestamp.fromDate(new Date(year, month + 1, 1));
    const shiftsCol = collection(db, 'shifts');
    const q = query(shiftsCol, where('start', '>=', start), where('start', '<', end));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const getShiftsForUser = async (uid: string, year: number, month: number): Promise<Shift[]> => {
    const start = Timestamp.fromDate(new Date(year, month, 1));
    const end = Timestamp.fromDate(new Date(year, month + 1, 1));
    const shiftsCol = collection(db, 'shifts');
    const q = query(shiftsCol,
        where('assignedStaffUids', 'array-contains', uid),
        where('start', '>=', start),
        where('start', '<', end));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const createShift = async (shiftData: Omit<Shift, 'id'>): Promise<void> => {
    const assignedStaffUids = shiftData.assignedStaff.map(s => s.uid);
    await addDoc(collection(db, 'shifts'), { ...shiftData, assignedStaffUids });

    // Notify assigned staff
    for (const staff of shiftData.assignedStaff) {
        await createNotification(staff.uid, `You have been assigned a new shift: ${shiftData.eventName} on ${shiftData.start.toDate().toLocaleDateString()}`, '/rota');
    }
};

export const updateShift = async (shiftId: string, shiftData: Partial<Omit<Shift, 'id'>>, originalAssignedUids: string[] = []): Promise<void> => {
    const assignedStaffUids = shiftData.assignedStaff?.map(s => s.uid);
    const dataToUpdate = assignedStaffUids ? { ...shiftData, assignedStaffUids } : shiftData;
    await updateDoc(doc(db, 'shifts', shiftId), dataToUpdate);

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
