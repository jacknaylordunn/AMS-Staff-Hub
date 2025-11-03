import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { User, Patient, EventLog, CompanyDocument, EPRFForm, Shift } from '../types';

const { Timestamp } = firebase.firestore;

// User Profile Functions
export const createUserProfile = async (uid: string, data: { email: string; displayName: string; role: User['role'], registrationNumber?: string }) => {
  await db.collection('users').doc(uid).set({
    ...data,
    createdAt: Timestamp.now(),
  });
};

export const getUserProfile = async (uid:string): Promise<User | null> => {
  const docRef = db.collection('users').doc(uid);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    return { uid, ...docSnap.data() } as User;
  }
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<Omit<User, 'uid' | 'email'>>) => {
  const userRef = db.collection('users').doc(uid);
  await userRef.update(data);
};

export const getUsers = async (): Promise<User[]> => {
    const usersCol = db.collection('users');
    const snapshot = await usersCol.orderBy('displayName').get();
    return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
};


// Patient Functions
export const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await db.collection('patients').add({
        ...patientData,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export const getPatientById = async (patientId: string): Promise<Patient | null> => {
    const docRef = db.collection('patients').doc(patientId);
    const docSnap = await docRef.get();
    if(docSnap.exists){
        return { id: docSnap.id, ...docSnap.data() } as Patient;
    }
    return null;
}

export const getPatients = async (searchTerm: string = ''): Promise<Patient[]> => {
    const patientsCol = db.collection('patients');
    const q = patientsCol.orderBy('lastName').limit(50);
    const snapshot = await q.get();
    const patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
    
    if (searchTerm) {
        return patients.filter(p => 
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.dob.includes(searchTerm)
        );
    }
    return patients;
}

export const searchPatients = async (searchTerm: string): Promise<Patient[]> => {
    if(!searchTerm) return [];
     const patientsCol = db.collection('patients');
    const q = patientsCol.orderBy('lastName');
    const snapshot = await q.get();
    const patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
    
    return patients.filter(p => 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.dob.includes(searchTerm.toLowerCase())
    );
}


// EPRF Functions
const prepareEPRFForFirebase = (eprfData: EPRFForm): Omit<EPRFForm, 'id'> => {
    const { id, ...dataToSave } = eprfData;
    return dataToSave;
};

export const createDraftEPRF = async (eprfData: EPRFForm): Promise<EPRFForm> => {
    const dataToSave = {
        ...prepareEPRFForFirebase(eprfData),
        status: 'Draft' as const,
        createdAt: Timestamp.now(),
    };
    const docRef = await db.collection('eprfs').add(dataToSave);
    return { ...eprfData, id: docRef.id, status: 'Draft', createdAt: dataToSave.createdAt };
};

export const getActiveDraftEPRF = async (userId: string, eventId: string): Promise<EPRFForm | null> => {
    const q = db.collection('eprfs')
        .where('createdBy.uid', '==', userId)
        .where('eventId', '==', eventId)
        .where('status', '==', 'Draft')
        .limit(1);
    const snapshot = await q.get();
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as EPRFForm;
};

export const getActiveDraftForUser = async (userId: string): Promise<EPRFForm | null> => {
    const q = db.collection('eprfs')
        .where('createdBy.uid', '==', userId)
        .where('status', '==', 'Draft')
        .orderBy('createdAt', 'desc')
        .limit(1);
     const snapshot = await q.get();
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as EPRFForm;
}

export const updateEPRF = async (eprfId: string, eprfData: EPRFForm): Promise<void> => {
    const docRef = db.collection('eprfs').doc(eprfId);
    const dataToSave = prepareEPRFForFirebase(eprfData);
    await docRef.update({ ...dataToSave });
};

export const finalizeEPRF = async (eprfId: string, eprfData: EPRFForm): Promise<void> => {
    const docRef = db.collection('eprfs').doc(eprfId);
    const dataToSave = prepareEPRFForFirebase(eprfData);
    await docRef.update({
        ...dataToSave,
        status: 'Pending Review' as const,
    });
};

export const deleteEPRF = async (eprfId: string): Promise<void> => {
    await db.collection('eprfs').doc(eprfId).delete();
};


export const getEPRFsForPatient = async (patientId: string): Promise<EPRFForm[]> => {
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol.where('patientId', '==', patientId).orderBy('createdAt', 'desc');
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
}

export const getPendingEPRFs = async (): Promise<EPRFForm[]> => {
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol.where('status', '==', 'Pending Review').orderBy('createdAt', 'desc');
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const approveEPRF = async (eprfId: string, reviewer: {uid: string, name: string}): Promise<void> => {
    const docRef = db.collection('eprfs').doc(eprfId);
    await docRef.update({
        status: 'Reviewed' as const,
        reviewedBy: { ...reviewer, date: Timestamp.now() }
    });
};

// Event Functions
export const getEvents = async (): Promise<EventLog[]> => {
    const eventsCol = db.collection('events');
    const q = eventsCol.orderBy('date', 'desc');
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EventLog));
}
export const createEvent = async (eventData: Omit<EventLog, 'id'>): Promise<void> => {
    await db.collection('events').add(eventData);
}
export const updateEvent = async (eventId: string, eventData: Partial<Omit<EventLog, 'id'>>): Promise<void> => {
    await db.collection('events').doc(eventId).update(eventData);
}
export const deleteEvent = async (eventId: string): Promise<void> => {
    await db.collection('events').doc(eventId).delete();
}

// Document Functions
export const getDocuments = async (): Promise<CompanyDocument[]> => {
    const docsCol = db.collection('documents');
    const snapshot = await docsCol.orderBy('title').get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CompanyDocument));
};
export const createDocument = async (docData: Omit<CompanyDocument, 'id'>): Promise<void> => {
    await db.collection('documents').add(docData);
}
export const deleteDocument = async (docId: string): Promise<void> => {
    await db.collection('documents').doc(docId).delete();
}


// Shift Functions
export const getShiftsForMonth = async (year: number, month: number): Promise<Shift[]> => {
    const start = Timestamp.fromDate(new Date(year, month, 1));
    const end = Timestamp.fromDate(new Date(year, month + 1, 1));
    const q = db.collection('shifts').where('start', '>=', start).where('start', '<', end);
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const getShiftsForUser = async (uid: string, year: number, month: number): Promise<Shift[]> => {
    const start = Timestamp.fromDate(new Date(year, month, 1));
    const end = Timestamp.fromDate(new Date(year, month + 1, 1));
    const q = db.collection('shifts')
        .where('assignedStaffUids', 'array-contains', uid)
        .where('start', '>=', start)
        .where('start', '<', end);
    
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
};

export const createShift = async (shiftData: Omit<Shift, 'id'>): Promise<void> => {
    const assignedStaffUids = shiftData.assignedStaff.map(s => s.uid);
    await db.collection('shifts').add({ ...shiftData, assignedStaffUids });
};

export const updateShift = async (shiftId: string, shiftData: Partial<Omit<Shift, 'id'>>): Promise<void> => {
    const assignedStaffUids = shiftData.assignedStaff?.map(s => s.uid);
    const dataToUpdate = assignedStaffUids ? { ...shiftData, assignedStaffUids } : shiftData;
    await db.collection('shifts').doc(shiftId).update(dataToUpdate);
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    await db.collection('shifts').doc(shiftId).delete();
};