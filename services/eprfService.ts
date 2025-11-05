import { collection, doc, addDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp, FieldValue, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import type { EPRFForm, AuditEntry } from '../types';
import { createNotification } from './notificationService';

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
    const docRef = await addDoc(collection(db, 'eprfs'), dataToSave);
    return { ...eprfData, id: docRef.id, status: 'Draft', createdAt: dataToSave.createdAt, auditLog: [auditEntry] };
};

// NOTE: This query requires a composite index in Firestore for optimal performance.
// The index should be on the 'eprfs' collection with the following fields:
// 1. createdBy.uid (Ascending)
// 2. eventId (Ascending)
// 3. status (Ascending)
export const getActiveDraftEPRF = async (userId: string, eventId: string): Promise<EPRFForm | null> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol,
        where('createdBy.uid', '==', userId),
        where('eventId', '==', eventId),
        where('status', '==', 'Draft'),
        limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as EPRFForm;
};

export const getActiveDraftForUser = async (userId: string): Promise<EPRFForm | null> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol,
        where('createdBy.uid', '==', userId),
        where('status', '==', 'Draft'),
        orderBy('createdAt', 'desc'),
        limit(1));
     const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as EPRFForm;
}

export const updateEPRF = async (eprfId: string, eprfData: EPRFForm): Promise<void> => {
    const docRef = doc(db, 'eprfs', eprfId);
    const dataToSave = prepareEPRFForFirebase(eprfData);
    await updateDoc(docRef, { ...dataToSave });
};

export const finalizeEPRF = async (eprfId: string, eprfData: EPRFForm): Promise<void> => {
    const docRef = doc(db, 'eprfs', eprfId);
    const dataToSave = prepareEPRFForFirebase(eprfData);
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: eprfData.createdBy,
        action: 'Submitted for Review'
    };
    await updateDoc(docRef, {
        ...dataToSave,
        status: 'Pending Review' as const,
        auditLog: arrayUnion(auditEntry)
    });
};

export const deleteEPRF = async (eprfId: string): Promise<void> => {
    await deleteDoc(doc(db, 'eprfs', eprfId));
};


export const getEPRFsForPatient = async (patientId: string): Promise<EPRFForm[]> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol, where('patientId', '==', patientId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
}

export const getRecentEPRFsForUser = async (userId: string, limitCount: number = 5): Promise<EPRFForm[]> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol,
        where('createdBy.uid', '==', userId),
        where('status', '!=', 'Draft'),
        orderBy('status'), // This is needed for the inequality, then order by date
        orderBy('createdAt', 'desc'),
        limit(limitCount));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));
}

export const getPendingEPRFs = async (): Promise<EPRFForm[]> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol, where('status', '==', 'Pending Review'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const getAllFinalizedEPRFs = async (): Promise<EPRFForm[]> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol, where('status', 'in', ['Pending Review', 'Reviewed']));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const approveEPRF = async (eprfId: string, eprfData: EPRFForm, reviewer: {uid: string, name: string}): Promise<void> => {
    const docRef = doc(db, 'eprfs', eprfId);
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: reviewer,
        action: 'Reviewed & Approved'
    };
    await updateDoc(docRef, {
        status: 'Reviewed' as const,
        reviewedBy: { ...reviewer, date: Timestamp.now() },
        auditLog: arrayUnion(auditEntry)
    });
};

export const returnEPRFToDraft = async (eprfId: string, eprfData: EPRFForm, manager: {uid: string, name: string}, reason: string): Promise<void> => {
    const docRef = doc(db, 'eprfs', eprfId);
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: manager,
        action: 'Returned for Correction',
        details: reason,
    };
    await updateDoc(docRef, {
        status: 'Draft' as const,
        reviewNotes: reason,
        auditLog: arrayUnion(auditEntry)
    });
    await createNotification(
        eprfData.createdBy.uid,
        `Your ePRF for ${eprfData.patientName} was returned for correction.`,
        `/patients/${eprfData.patientId}`
    );
}
