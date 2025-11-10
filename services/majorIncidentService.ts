import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { MajorIncident, METHANEreport, StaffCheckin, User } from '../types';
import { sendAnnouncement } from './announcementService';

// --- Incident Management ---

export const getIncidents = async (): Promise<MajorIncident[]> => {
    const incidentsCol = firestore.collection(db, 'majorIncidents');
    const q = firestore.query(incidentsCol, firestore.orderBy('declaredAt', 'desc'));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MajorIncident));
};

export const getActiveIncidents = async (): Promise<MajorIncident[]> => {
    const incidentsCol = firestore.collection(db, 'majorIncidents');
    const q = firestore.query(incidentsCol, firestore.where('status', '==', 'Active'));
    const snapshot = await firestore.getDocs(q);
    const incidents = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MajorIncident));
    // Sort client-side to avoid needing a composite index
    incidents.sort((a, b) => b.declaredAt.toMillis() - a.declaredAt.toMillis());
    return incidents;
}

export const getIncidentById = async (incidentId: string): Promise<MajorIncident | null> => {
    const docRef = firestore.doc(db, 'majorIncidents', incidentId);
    const docSnap = await firestore.getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as MajorIncident;
}

export const declareMajorIncident = async (data: { name: string, location: string, initialDetails: string }, declarer: { uid: string, name: string }): Promise<string> => {
    const incidentData = {
        ...data,
        status: 'Active' as const,
        declaredAt: firestore.Timestamp.now(),
        declaredBy: declarer,
    };
    const docRef = await firestore.addDoc(firestore.collection(db, 'majorIncidents'), incidentData);
    
    // Send notification to all users
    await sendAnnouncement(
        `MAJOR INCIDENT DECLARED: ${data.name}. All staff check status on the Aegis Hub.`,
        { type: 'all' },
        `/major-incidents/${docRef.id}`
    );

    return docRef.id;
};

export const standDownIncident = async (incidentId: string): Promise<void> => {
    await firestore.updateDoc(firestore.doc(db, 'majorIncidents', incidentId), {
        status: 'Stood Down',
        stoodDownAt: firestore.Timestamp.now(),
    });
};

export const deleteIncident = async (incidentId: string): Promise<void> => {
    // This function deletes the main incident document.
    // NOTE: In a production environment, subcollections (methaneReports, checkins)
    // are NOT automatically deleted. A Firebase Cloud Function triggered on document
    // deletion would be required to clean up subcollections.
    await firestore.deleteDoc(firestore.doc(db, 'majorIncidents', incidentId));
};


// --- METHANE Reports ---

export const submitMethaneReport = async (reportData: Omit<METHANEreport, 'id' | 'submittedAt'>): Promise<void> => {
    const reportsCol = firestore.collection(db, 'majorIncidents', reportData.incidentId, 'methaneReports');
    await firestore.addDoc(reportsCol, {
        ...reportData,
        submittedAt: firestore.Timestamp.now(),
    });
};

export const getIncidentMethaneReports = (incidentId: string, callback: (reports: METHANEreport[]) => void): firestore.Unsubscribe => {
    const reportsCol = firestore.collection(db, 'majorIncidents', incidentId, 'methaneReports');
    const q = firestore.query(reportsCol, firestore.orderBy('submittedAt', 'desc'));
    return firestore.onSnapshot(q, (snapshot) => {
        const reports = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as METHANEreport));
        callback(reports);
    });
};

// --- Staff Check-in ---

export const checkInToIncident = async (incidentId: string, user: User, status: StaffCheckin['status']): Promise<void> => {
    const checkinRef = firestore.doc(db, 'majorIncidents', incidentId, 'checkins', user.uid);
    await firestore.setDoc(checkinRef, {
        incidentId: incidentId,
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        userRole: user.role,
        status: status,
        timestamp: firestore.Timestamp.now(),
    });
};

export const getIncidentStaffCheckins = (incidentId: string, callback: (checkins: StaffCheckin[]) => void): firestore.Unsubscribe => {
    const checkinsCol = firestore.collection(db, 'majorIncidents', incidentId, 'checkins');
    const q = firestore.query(checkinsCol, firestore.orderBy('timestamp', 'desc'));
    return firestore.onSnapshot(q, (snapshot) => {
        const checkins = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StaffCheckin));
        callback(checkins);
    });
};