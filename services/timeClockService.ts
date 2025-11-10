
// FIX: Use compat firestore syntax and types.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';
import type { TimeClockEntry, Shift, User } from '../types';

export const getActiveClockInForUser = async (userId: string): Promise<TimeClockEntry | null> => {
    // FIX: Use compat 'collection' and 'query' methods.
    const clockCol = db.collection('timeClockEntries');
    const q = clockCol
        .where('userId', '==', userId)
        .where('status', '==', 'Clocked In')
        .limit(1);
    
    // FIX: Use compat 'get' method.
    const snapshot = await q.get();
    if (snapshot.empty) {
        return null;
    }
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as TimeClockEntry;
};

export const clockIn = async (shift: Shift, user: User, location: GeolocationCoordinates | null): Promise<TimeClockEntry> => {
    const mySlot = (shift.slots || []).find(s => s.assignedStaff?.uid === user.uid);
    const roleForShiftName = mySlot ? mySlot.roleRequired : 'Staff';

    const newEntryData: Omit<TimeClockEntry, 'id'> = {
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        shiftId: shift.id!,
        shiftName: `${roleForShiftName} at ${shift.eventName}`,
        // FIX: Use compat 'Timestamp'.
        clockInTime: firebase.firestore.Timestamp.now(),
        status: 'Clocked In',
        // FIX: Use compat 'GeoPoint'.
        ...(location && { clockInLocation: new firebase.firestore.GeoPoint(location.latitude, location.longitude) }),
    };

    // FIX: Use compat 'add' method on a collection.
    const docRef = await db.collection('timeClockEntries').add(newEntryData);
    return { id: docRef.id, ...newEntryData, clockInTime: newEntryData.clockInTime };
};

export const clockOut = async (entryId: string, clockInTime: firebase.firestore.Timestamp, location: GeolocationCoordinates | null): Promise<void> => {
    // FIX: Use compat 'doc' method.
    const docRef = db.doc(`timeClockEntries/${entryId}`);
    // FIX: Use compat 'Timestamp'.
    const clockOutTime = firebase.firestore.Timestamp.now();
    const durationMillis = clockOutTime.toMillis() - clockInTime.toMillis();
    const durationHours = durationMillis / (1000 * 60 * 60);

    const updateData: Partial<TimeClockEntry> = {
        clockOutTime,
        status: 'Clocked Out',
        durationHours: parseFloat(durationHours.toFixed(2)),
        // FIX: Use compat 'GeoPoint'.
        ...(location && { clockOutLocation: new firebase.firestore.GeoPoint(location.latitude, location.longitude) }),
    };

    // FIX: Use compat 'update' method.
    await docRef.update(updateData);
};

export const getTimeClockEntriesForDateRange = async (start: Date, end: Date): Promise<TimeClockEntry[]> => {
    // FIX: Use compat firestore methods.
    const clockCol = db.collection('timeClockEntries');
    const q = clockCol
        .where('clockInTime', '>=', start)
        .where('clockInTime', '<=', end)
        .orderBy('clockInTime', 'desc');
    
    // FIX: Use compat 'get' method.
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeClockEntry));
};
