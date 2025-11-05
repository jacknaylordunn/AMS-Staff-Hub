// FIX: The errors indicate members are not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { EPRFForm, AuditEntry } from '../types';
import { createNotification } from './notificationService';

// EPRF Functions
const prepareEPRFForFirebase = (eprfData: EPRFForm): Omit<EPRFForm, 'id'> => {
    const { id, ...dataToSave } = eprfData;
    return dataToSave;
};

export const getIncidentNumber = async (): Promise<string> => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `AMS${yyyy}${mm}${dd}`;

    const startOfDay = new Date(yyyy, now.getMonth(), now.getDate());
    const startTimestamp = firestore.Timestamp.fromDate(startOfDay);

    const eprfsCol = firestore.collection(db, 'eprfs');
    const q = firestore.query(eprfsCol, firestore.where('createdAt', '>=', startTimestamp));
    
    const snapshot = await firestore.getCountFromServer(q);
    const count = snapshot.data().count;

    const nextId = String(count + 1).padStart(4, '0');

    return `${datePrefix}${nextId}`;
};


export const createDraftEPRF = async (eprfData: EPRFForm): Promise<EPRFForm> => {
    const auditEntry: AuditEntry = {
        timestamp: firestore.Timestamp.now(),
        user: eprfData.createdBy,
        action: 'Draft Created'
    };
    const dataToSave = {
        ...prepareEPRFForFirebase(eprfData),
        incidentNumber: '',
        status: 'Draft' as const,
        createdAt: firestore.Timestamp.now(),
        auditLog: [auditEntry]
    };
    const docRef = await firestore.addDoc(firestore.collection(db, 'eprfs'), dataToSave);
    return { ...eprfData, id: docRef.id, status: 'Draft', createdAt: dataToSave.createdAt, auditLog: [auditEntry], incidentNumber: '' };
};

export const getActiveDraftsForEvent = async (userId: string, eventId: string): Promise<EPRFForm[]> => {
    const eprfsCol = firestore.collection(db, 'eprfs');
    const q = firestore.query(eprfsCol,
        firestore.where('createdBy.uid', '==', userId),
        firestore.where('status', '==', 'Draft'));
    const snapshot = await firestore.getDocs(q);

    if (snapshot.empty) {
        return [];
    }
    
    const eventDraftDocs = snapshot.docs.filter(doc => doc.data().eventId === eventId);

    return eventDraftDocs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));
};


export const getAllDraftsForUser = async (userId: string): Promise<EPRFForm[]> => {
    const eprfsCol = firestore.collection(db, 'eprfs');
    const q = firestore.query(eprfsCol,
        firestore.where('createdBy.uid', '==', userId),
        firestore.where('status', '==', 'Draft'),
        firestore.orderBy('createdAt', 'desc'));
     const snapshot = await firestore.getDocs(q);
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));
}

export const getEPRFById = async (eprfId: string): Promise<EPRFForm | null> => {
    const docRef = firestore.doc(db, 'eprfs', eprfId);
    const docSnap = await firestore.getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as EPRFForm;
}

export const updateEPRF = async (eprfId: string, eprfData: EPRFForm): Promise<void> => {
    const docRef = firestore.doc(db, 'eprfs', eprfId);
    const dataToSave = prepareEPRFForFirebase(eprfData);
    await firestore.updateDoc(docRef, { ...dataToSave });
};

export const finalizeEPRF = async (eprfId: string, eprfData: EPRFForm): Promise<void> => {
    const docRef = firestore.doc(db, 'eprfs', eprfId);
    const dataToSave = prepareEPRFForFirebase(eprfData);
    const auditEntry: AuditEntry = {
        timestamp: firestore.Timestamp.now(),
        user: eprfData.createdBy,
        action: 'Submitted for Review'
    };
    await firestore.updateDoc(docRef, {
        ...dataToSave,
        status: 'Pending Review' as const,
        auditLog: firestore.arrayUnion(auditEntry)
    });
};

export const deleteEPRF = async (eprfId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'eprfs', eprfId));
};


export const getEPRFsForPatient = async (patientId: string): Promise<EPRFForm[]> => {
    const eprfsCol = firestore.collection(db, 'eprfs');
    const q = firestore.query(eprfsCol, firestore.where('patientId', '==', patientId), firestore.orderBy('createdAt', 'desc'));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
}

export const getRecentEPRFsForUser = async (userId: string, limitCount: number = 5): Promise<EPRFForm[]> => {
    const eprfsCol = firestore.collection(db, 'eprfs');
    // Simplified query to avoid composite index on status field. Filtering and limiting is done client-side.
    const q = firestore.query(eprfsCol,
        firestore.where('createdBy.uid', '==', userId),
        firestore.orderBy('createdAt', 'desc'));
    
    const snapshot = await firestore.getDocs(q);
    const allUserEprfs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));

    // Client-side filtering to exclude drafts and apply limit
    const finalizedEprfs = allUserEprfs.filter(eprf => eprf.status !== 'Draft');
    return finalizedEprfs.slice(0, limitCount);
}

export const getPendingEPRFs = async (): Promise<EPRFForm[]> => {
    const eprfsCol = firestore.collection(db, 'eprfs');
    const q = firestore.query(eprfsCol, firestore.where('status', '==', 'Pending Review'), firestore.orderBy('createdAt', 'desc'));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const getAllFinalizedEPRFs = async (): Promise<EPRFForm[]> => {
    const eprfsCol = firestore.collection(db, 'eprfs');
    const q = firestore.query(eprfsCol, firestore.where('status', 'in', ['Pending Review', 'Reviewed']));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const approveEPRF = async (eprfId: string, reviewer: {uid: string, name: string}): Promise<void> => {
    const docRef = firestore.doc(db, 'eprfs', eprfId);
    const auditEntry: AuditEntry = {
        timestamp: firestore.Timestamp.now(),
        user: reviewer,
        action: 'Reviewed & Approved'
    };
    await firestore.updateDoc(docRef, {
        status: 'Reviewed' as const,
        reviewedBy: { ...reviewer, date: firestore.Timestamp.now() },
        reviewNotes: null, // Clear any previous "return to draft" notes
        auditLog: firestore.arrayUnion(auditEntry)
    });
};

export const returnEPRFToDraft = async (eprfId: string, eprfData: EPRFForm, manager: {uid: string, name: string}, reason: string): Promise<void> => {
    const docRef = firestore.doc(db, 'eprfs', eprfId);
    const auditEntry: AuditEntry = {
        timestamp: firestore.Timestamp.now(),
        user: manager,
        action: 'Returned for Correction',
        details: reason,
    };
    await firestore.updateDoc(docRef, {
        status: 'Draft' as const,
        reviewNotes: reason,
        auditLog: firestore.arrayUnion(auditEntry)
    });
    await createNotification(
        eprfData.createdBy.uid,
        `Your ePRF for ${eprfData.patientName} was returned for correction.`,
        `/patients/${eprfData.patientId}`
    );
}

export const getEPRFsToSyncSignatures = async (userId: string): Promise<EPRFForm[]> => {
    const eprfsCol = firestore.collection(db, 'eprfs');
    const q = firestore.query(eprfsCol, 
        firestore.where('createdBy.uid', '==', userId), 
        firestore.where('signaturesNeedSync', '==', true)
    );
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const updateSyncedSignatures = async (eprfId: string, updates: { clinicianSignatureUrl?: string, patientSignatureUrl?: string }): Promise<void> => {
    const docRef = firestore.doc(db, 'eprfs', eprfId);
    await firestore.updateDoc(docRef, {
        ...updates,
        signaturesNeedSync: false
    });
};