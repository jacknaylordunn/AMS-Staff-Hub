import { collection, doc, addDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp, FieldValue, arrayUnion, getCountFromServer } from 'firebase/firestore';
import { db } from './firebase';
import type { EPRFForm, AuditEntry } from '../types';
import { createNotification } from './notificationService';

// EPRF Functions
const prepareEPRFForFirebase = (eprfData: EPRFForm): Omit<EPRFForm, 'id'> => {
    const { id, ...dataToSave } = eprfData;
    return dataToSave;
};

const getIncidentNumber = async (): Promise<string> => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `AMS${yyyy}${mm}${dd}`;

    const startOfDay = new Date(yyyy, now.getMonth(), now.getDate());
    const startTimestamp = Timestamp.fromDate(startOfDay);

    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol, where('createdAt', '>=', startTimestamp));
    
    const snapshot = await getCountFromServer(q);
    const count = snapshot.data().count;

    const nextId = String(count + 1).padStart(4, '0');

    return `${datePrefix}${nextId}`;
};


export const createDraftEPRF = async (eprfData: EPRFForm): Promise<EPRFForm> => {
    const incidentNumber = await getIncidentNumber();
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: eprfData.createdBy,
        action: 'Draft Created'
    };
    const dataToSave = {
        ...prepareEPRFForFirebase(eprfData),
        incidentNumber,
        status: 'Draft' as const,
        createdAt: Timestamp.now(),
        auditLog: [auditEntry]
    };
    const docRef = await addDoc(collection(db, 'eprfs'), dataToSave);
    return { ...eprfData, id: docRef.id, status: 'Draft', createdAt: dataToSave.createdAt, auditLog: [auditEntry], incidentNumber };
};

export const getActiveDraftsForEvent = async (userId: string, eventId: string): Promise<EPRFForm[]> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol,
        where('createdBy.uid', '==', userId),
        where('status', '==', 'Draft'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return [];
    }
    
    const eventDraftDocs = snapshot.docs.filter(doc => doc.data().eventId === eventId);

    return eventDraftDocs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));
};


export const getAllDraftsForUser = async (userId: string): Promise<EPRFForm[]> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol,
        where('createdBy.uid', '==', userId),
        where('status', '==', 'Draft'),
        orderBy('createdAt', 'desc'));
     const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));
}

export const getEPRFById = async (eprfId: string): Promise<EPRFForm | null> => {
    const docRef = doc(db, 'eprfs', eprfId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as EPRFForm;
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
    // Simplified query to avoid composite index on status field. Filtering and limiting is done client-side.
    const q = query(eprfsCol,
        where('createdBy.uid', '==', userId),
        orderBy('createdAt', 'desc'));
    
    const snapshot = await getDocs(q);
    const allUserEprfs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));

    // Client-side filtering to exclude drafts and apply limit
    const finalizedEprfs = allUserEprfs.filter(eprf => eprf.status !== 'Draft');
    return finalizedEprfs.slice(0, limitCount);
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

export const approveEPRF = async (eprfId: string, reviewer: {uid: string, name: string}): Promise<void> => {
    const docRef = doc(db, 'eprfs', eprfId);
    const auditEntry: AuditEntry = {
        timestamp: Timestamp.now(),
        user: reviewer,
        action: 'Reviewed & Approved'
    };
    await updateDoc(docRef, {
        status: 'Reviewed' as const,
        reviewedBy: { ...reviewer, date: Timestamp.now() },
        reviewNotes: null, // Clear any previous "return to draft" notes
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

export const getEPRFsToSyncSignatures = async (userId: string): Promise<EPRFForm[]> => {
    const eprfsCol = collection(db, 'eprfs');
    const q = query(eprfsCol, 
        where('createdBy.uid', '==', userId), 
        where('signaturesNeedSync', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const updateSyncedSignatures = async (eprfId: string, updates: { clinicianSignatureUrl?: string, patientSignatureUrl?: string }): Promise<void> => {
    const docRef = doc(db, 'eprfs', eprfId);
    await updateDoc(docRef, {
        ...updates,
        signaturesNeedSync: false
    });
};