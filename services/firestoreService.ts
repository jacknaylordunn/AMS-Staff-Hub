import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { User, Patient, EventLog, CompanyDocument, EPRFForm, Shift, AuditEntry, Notification, Vehicle, VehicleCheck, Announcement } from '../types';

const { Timestamp } = firebase.firestore;

// Notification Functions
export const createNotification = async (userId: string, message: string, link?: string) => {
    await db.collection('notifications').add({
        userId,
        message,
        link: link || '',
        read: false,
        createdAt: Timestamp.now(),
    });
};

export const getNotificationsForUser = async (userId: string): Promise<Notification[]> => {
    const q = db.collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(10);
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    await db.collection('notifications').doc(notificationId).update({ read: true });
};


// User Profile Functions
export const createUserProfile = async (uid: string, data: { email: string; firstName: string; lastName: string; role: User['role'], registrationNumber?: string }) => {
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
    const snapshot = await usersCol.orderBy('lastName').get();
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
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: eprfData.createdBy,
        action: 'Draft Created'
    };
    const dataToSave = {
        ...prepareEPRFForFirebase(eprfData),
        status: 'Draft' as const,
        createdAt: Timestamp.now(),
        auditLog: [auditEntry]
    };
    const docRef = await db.collection('eprfs').add(dataToSave);
    return { ...eprfData, id: docRef.id, status: 'Draft', createdAt: dataToSave.createdAt, auditLog: [auditEntry] };
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
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: eprfData.createdBy,
        action: 'Submitted for Review'
    };
    await docRef.update({
        ...dataToSave,
        status: 'Pending Review' as const,
        auditLog: firebase.firestore.FieldValue.arrayUnion(auditEntry)
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

export const getAllFinalizedEPRFs = async (): Promise<EPRFForm[]> => {
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol.where('status', 'in', ['Pending Review', 'Reviewed']);
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const approveEPRF = async (eprfId: string, eprfData: EPRFForm, reviewer: {uid: string, name: string}): Promise<void> => {
    const docRef = db.collection('eprfs').doc(eprfId);
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: reviewer,
        action: 'Reviewed & Approved'
    };
    await docRef.update({
        status: 'Reviewed' as const,
        reviewedBy: { ...reviewer, date: Timestamp.now() },
        auditLog: firebase.firestore.FieldValue.arrayUnion(auditEntry)
    });
};

export const returnEPRFToDraft = async (eprfId: string, eprfData: EPRFForm, manager: {uid: string, name: string}, reason: string): Promise<void> => {
    const docRef = db.collection('eprfs').doc(eprfId);
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: manager,
        action: 'Returned for Correction',
        details: reason,
    };
    await docRef.update({
        status: 'Draft' as const,
        reviewNotes: reason,
        auditLog: firebase.firestore.FieldValue.arrayUnion(auditEntry)
    });
    await createNotification(
        eprfData.createdBy.uid,
        `Your ePRF for ${eprfData.patientName} was returned for correction.`,
        `/patients/${eprfData.patientId}`
    );
}

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

    // Notify assigned staff
    for (const staff of shiftData.assignedStaff) {
        await createNotification(staff.uid, `You have been assigned a new shift: ${shiftData.eventName} on ${shiftData.start.toDate().toLocaleDateString()}`, '/rota');
    }
};

export const updateShift = async (shiftId: string, shiftData: Partial<Omit<Shift, 'id'>>, originalAssignedUids: string[] = []): Promise<void> => {
    const assignedStaffUids = shiftData.assignedStaff?.map(s => s.uid);
    const dataToUpdate = assignedStaffUids ? { ...shiftData, assignedStaffUids } : shiftData;
    await db.collection('shifts').doc(shiftId).update(dataToUpdate);

    // Notify newly assigned staff
    const newStaff = shiftData.assignedStaff?.filter(s => !originalAssignedUids.includes(s.uid));
    if (newStaff) {
        for (const staff of newStaff) {
            await createNotification(staff.uid, `You have been assigned to a shift: ${shiftData.eventName} on ${shiftData.start?.toDate().toLocaleDateString()}`, '/rota');
        }
    }
};

export const deleteShift = async (shiftId: string): Promise<void> => {
    await db.collection('shifts').doc(shiftId).delete();
};

// Vehicle/Asset Functions
export const getVehicles = async (): Promise<Vehicle[]> => {
    const snapshot = await db.collection('vehicles').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
}

export const getVehicleById = async (vehicleId: string): Promise<Vehicle | null> => {
    const doc = await db.collection('vehicles').doc(vehicleId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Vehicle;
}

export const addVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'lastCheck'>): Promise<void> => {
    await db.collection('vehicles').add({
        ...vehicleData,
        createdAt: Timestamp.now(),
    });
}

export const updateVehicle = async (vehicleId: string, vehicleData: Partial<Omit<Vehicle, 'id'>>): Promise<void> => {
    await db.collection('vehicles').doc(vehicleId).update(vehicleData);
}

export const deleteVehicle = async (vehicleId: string): Promise<void> => {
    await db.collection('vehicles').doc(vehicleId).delete();
}

export const getVehicleChecks = async(vehicleId: string): Promise<VehicleCheck[]> => {
    const snapshot = await db.collection('vehicles').doc(vehicleId).collection('checks').orderBy('date', 'desc').limit(20).get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VehicleCheck));
}

export const addVehicleCheck = async (vehicleId: string, checkData: Omit<VehicleCheck, 'id' | 'date'>): Promise<void> => {
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const checksRef = vehicleRef.collection('checks');

    const now = Timestamp.now();

    // Add the check document
    await checksRef.add({
        ...checkData,
        date: now,
    });

    // Update the parent vehicle's lastCheck status
    await vehicleRef.update({
        'lastCheck.date': now,
        'lastCheck.user': checkData.user,
        'lastCheck.status': checkData.overallStatus,
        status: checkData.overallStatus === 'Issues Found' ? 'Maintenance Required' : 'In Service'
    });
};

// Announcement Functions
export const getAnnouncements = async (): Promise<Announcement[]> => {
    const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').limit(20).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
}

export const sendAnnouncementToAllUsers = async (message: string, sender: { uid: string; name: string; }): Promise<void> => {
    const announcementData = {
        message,
        sentBy: sender,
        createdAt: Timestamp.now(),
    };
    // 1. Save the announcement to its own collection for history
    await db.collection('announcements').add(announcementData);

    // 2. Create notifications for all users
    const usersSnapshot = await db.collection('users').get();
    const batch = db.batch();

    usersSnapshot.docs.forEach(userDoc => {
        const notificationsRef = db.collection('notifications').doc();
        const truncatedMessage = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        batch.set(notificationsRef, {
            userId: userDoc.id,
            message: `New Hub Announcement: "${truncatedMessage}"`,
            read: false,
            createdAt: Timestamp.now(),
            link: '/dashboard'
        });
    });
    
    await batch.commit();
}