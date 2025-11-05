import { collection, doc, addDoc, getDocs, getDoc, updateDoc, setDoc, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { MajorIncident, METHANEreport, StaffCheckin, User } from '../types';
import { sendAnnouncementToAllUsers } from './announcementService';

// --- Incident Management ---

export const getIncidents = async (): Promise<MajorIncident[]> => {
    const incidentsCol = collection(db, 'majorIncidents');
    const q = query(incidentsCol, orderBy('declaredAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MajorIncident));
};

export const getActiveIncidents = async (): Promise<MajorIncident[]> => {
    const incidentsCol = collection(db, 'majorIncidents');
    const q = query(incidentsCol, where('status', '==', 'Active'), orderBy('declaredAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MajorIncident));
}

export const getIncidentById = async (incidentId: string): Promise<MajorIncident | null> => {
    const docRef = doc(db, 'majorIncidents', incidentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as MajorIncident;
}

export const declareMajorIncident = async (data: { name: string, location: string, initialDetails: string }, declarer: { uid: string, name: string }): Promise<string> => {
    const incidentData = {
        ...data,
        status: 'Active' as const,
        declaredAt: Timestamp.now(),
        declaredBy: declarer,
    };
    const docRef = await addDoc(collection(db, 'majorIncidents'), incidentData);
    
    // Send notification to all users
    await sendAnnouncementToAllUsers(
        `MAJOR INCIDENT DECLARED: ${data.name}. All staff check status on the Aegis Hub.`,
        declarer,
        `/major-incidents/${docRef.id}`
    );

    return docRef.id;
};

export const standDownIncident = async (incidentId: string): Promise<void> => {
    await updateDoc(doc(db, 'majorIncidents', incidentId), {
        status: 'Stood Down',
        stoodDownAt: Timestamp.now(),
    });
};

// --- METHANE Reports ---

export const submitMethaneReport = async (reportData: Omit<METHANEreport, 'id' | 'submittedAt'>): Promise<void> => {
    const reportsCol = collection(db, 'majorIncidents', reportData.incidentId, 'methaneReports');
    await addDoc(reportsCol, {
        ...reportData,
        submittedAt: Timestamp.now(),
    });
};

export const getIncidentMethaneReports = (incidentId: string, callback: (reports: METHANEreport[]) => void) => {
    const reportsCol = collection(db, 'majorIncidents', incidentId, 'methaneReports');
    const q = query(reportsCol, orderBy('submittedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const reports = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as METHANEreport));
        callback(reports);
    });
};

// --- Staff Check-in ---

export const checkInToIncident = async (incidentId: string, user: User, status: StaffCheckin['status']): Promise<void> => {
    const checkinRef = doc(db, 'majorIncidents', incidentId, 'checkins', user.uid);
    await setDoc(checkinRef, {
        incidentId: incidentId,
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        userRole: user.role,
        status: status,
        timestamp: Timestamp.now(),
    });
};

export const getIncidentStaffCheckins = (incidentId: string, callback: (checkins: StaffCheckin[]) => void) => {
    const checkinsCol = collection(db, 'majorIncidents', incidentId, 'checkins');
    const q = query(checkinsCol, orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const checkins = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StaffCheckin));
        callback(checkins);
    });
};