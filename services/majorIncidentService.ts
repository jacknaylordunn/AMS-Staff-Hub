import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { MajorIncident, METHANEreport, StaffCheckin, User } from '../types';
import { sendAnnouncement } from './announcementService';

// --- Incident Management ---

export const getIncidents = async (): Promise<MajorIncident[]> => {
    const incidentsCol = db.collection('majorIncidents');
    const q = incidentsCol.orderBy('declaredAt', 'desc');
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MajorIncident));
};

export const getActiveIncidents = async (): Promise<MajorIncident[]> => {
    const incidentsCol = db.collection('majorIncidents');
    const q = incidentsCol.where('status', '==', 'Active');
    const snapshot = await q.get();
    const incidents = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MajorIncident));
    // Sort client-side to avoid needing a composite index
    incidents.sort((a, b) => b.declaredAt.toMillis() - a.declaredAt.toMillis());
    return incidents;
}

export const getIncidentById = async (incidentId: string): Promise<MajorIncident | null> => {
    const docRef = db.doc(`majorIncidents/${incidentId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return null;
    return { id: docSnap.id, ...docSnap.data() } as MajorIncident;
}

export const declareMajorIncident = async (data: { name: string, location: string, initialDetails: string }, declarer: { uid: string, name: string }): Promise<string> => {
    const incidentData = {
        ...data,
        status: 'Active' as const,
        declaredAt: firebase.firestore.Timestamp.now(),
        declaredBy: declarer,
    };
    const docRef = await db.collection('majorIncidents').add(incidentData);
    
    // Send notification to all users
    await sendAnnouncement(
        `MAJOR INCIDENT DECLARED: ${data.name}. All staff check status on the Aegis Hub.`,
        { type: 'all' },
        `/major-incidents/${docRef.id}`
    );

    return docRef.id;
};

export const standDownIncident = async (incidentId: string): Promise<void> => {
    await db.doc(`majorIncidents/${incidentId}`).update({
        status: 'Stood Down',
        stoodDownAt: firebase.firestore.Timestamp.now(),
    });
};

export const deleteIncident = async (incidentId: string): Promise<void> => {
    // This function deletes the main incident document.
    // A cloud function 'onMajorIncidentDelete' is now responsible for cleaning up subcollections.
    await db.doc(`majorIncidents/${incidentId}`).delete();
};


// --- METHANE Reports ---

export const submitMethaneReport = async (reportData: Omit<METHANEreport, 'id' | 'submittedAt'>): Promise<void> => {
    const reportsCol = db.collection('majorIncidents').doc(reportData.incidentId).collection('methaneReports');
    await reportsCol.add({
        ...reportData,
        submittedAt: firebase.firestore.Timestamp.now(),
    });
};

export const getIncidentMethaneReports = (incidentId: string, callback: (reports: METHANEreport[]) => void): () => void => {
    const reportsCol = db.collection('majorIncidents').doc(incidentId).collection('methaneReports');
    const q = reportsCol.orderBy('submittedAt', 'desc');
    return q.onSnapshot((snapshot) => {
        const reports = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as METHANEreport));
        callback(reports);
    });
};

// --- Staff Check-in ---

export const checkInToIncident = async (incidentId: string, user: User, status: StaffCheckin['status']): Promise<void> => {
    const checkinRef = db.doc(`majorIncidents/${incidentId}/checkins/${user.uid}`);
    await checkinRef.set({
        incidentId: incidentId,
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        userRole: user.role,
        status: status,
        timestamp: firebase.firestore.Timestamp.now(),
    });
};

export const getIncidentStaffCheckins = (incidentId: string, callback: (checkins: StaffCheckin[]) => void): () => void => {
    const checkinsCol = db.collection('majorIncidents').doc(incidentId).collection('checkins');
    const q = checkinsCol.orderBy('timestamp', 'desc');
    return q.onSnapshot((snapshot) => {
        const checkins = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StaffCheckin));
        callback(checkins);
    });
};