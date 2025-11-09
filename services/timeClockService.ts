import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { TimeClockEntry, Shift, User } from '../types';

export const getActiveClockInForUser = async (userId: string): Promise<TimeClockEntry | null> => {
    const clockCol = firestore.collection(db, 'timeClockEntries');
    const q = firestore.query(
        clockCol,
        firestore.where('userId', '==', userId),
        firestore.where('status', '==', 'Clocked In'),
        firestore.limit(1)
    );
    const snapshot = await firestore.getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as TimeClockEntry;
};

export const clockIn = async (shift: Shift, user: User, location: GeolocationCoordinates | null): Promise<TimeClockEntry> => {
    const newEntryData: Omit<TimeClockEntry, 'id'> = {
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        shiftId: shift.id!,
        shiftName: `${shift.roleRequired} at ${shift.eventName}`,
        eventId: shift.eventId,
        clockInTime: firestore.Timestamp.now(),
        status: 'Clocked In',
        ...(location && { clockInLocation: new firestore.GeoPoint(location.latitude, location.longitude) }),
    };

    const docRef = await firestore.addDoc(firestore.collection(db, 'timeClockEntries'), newEntryData);
    return { id: docRef.id, ...newEntryData, clockInTime: newEntryData.clockInTime };
};

export const clockOut = async (entryId: string, clockInTime: firestore.Timestamp, location: GeolocationCoordinates | null): Promise<void> => {
    const docRef = firestore.doc(db, 'timeClockEntries', entryId);
    const clockOutTime = firestore.Timestamp.now();
    const durationMillis = clockOutTime.toMillis() - clockInTime.toMillis();
    const durationHours = durationMillis / (1000 * 60 * 60);

    const updateData: Partial<TimeClockEntry> = {
        clockOutTime,
        status: 'Clocked Out',
        durationHours: parseFloat(durationHours.toFixed(2)),
        ...(location && { clockOutLocation: new firestore.GeoPoint(location.latitude, location.longitude) }),
    };

    await firestore.updateDoc(docRef, updateData);
};

export const getTimeClockEntriesForDateRange = async (start: Date, end: Date): Promise<TimeClockEntry[]> => {
    const clockCol = firestore.collection(db, 'timeClockEntries');
    const q = firestore.query(
        clockCol,
        firestore.where('clockInTime', '>=', start),
        firestore.where('clockInTime', '<=', end),
        firestore.orderBy('clockInTime', 'desc')
    );
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeClockEntry));
};
