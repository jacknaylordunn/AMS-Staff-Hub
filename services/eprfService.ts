import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { EPRFForm, AuditEntry, MedicationAdministered, User as AppUser } from '../types';
import { addLedgerEntry } from './drugLedgerService';

// Removes 'id' and any 'undefined' values before saving to Firestore.
const prepareEPRFForFirebase = (eprfData: EPRFForm): Omit<EPRFForm, 'id'> => {
    const { id, ...dataToSave } = eprfData;
    const cleanedData: { [key: string]: any } = {};
    for (const key in dataToSave) {
        if ((dataToSave as any)[key] !== undefined) {
            cleanedData[key] = (dataToSave as any)[key];
        }
    }
    return cleanedData as Omit<EPRFForm, 'id'>;
};


// EPRF Functions
export const getIncidentNumber = async (): Promise<string> => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `AMS${yyyy}${mm}${dd}`;

    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const counterRef = db.doc(`counters/${datePrefix}`);

    try {
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
        const newCount = await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            
            const currentCount = counterDoc.exists ? counterDoc.data()!.count : 0;
            const newCount = currentCount + 1;

            transaction.set(counterRef, { count: newCount }, { merge: true });
            
            return newCount;
        });

        const nextId = String(newCount).padStart(4, '0');
        return `${datePrefix}${nextId}`;
    } catch (e) {
        console.error("Incident number transaction failed: ", e);
        throw new Error("Could not generate a unique incident number.");
    }
};


export const createDraftEPRF = async (eprfData: EPRFForm): Promise<EPRFForm> => {
    const auditEntry: AuditEntry = {
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
        timestamp: firebase.firestore.Timestamp.now(),
        user: eprfData.createdBy,
        action: 'Draft Created'
    };
    const dataToSave = {
        ...prepareEPRFForFirebase(eprfData),
        incidentNumber: '',
        status: 'Draft' as const,
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
        createdAt: firebase.firestore.Timestamp.now(),
        auditLog: [auditEntry]
    };
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const docRef = await db.collection('eprfs').add(dataToSave);
    return { ...eprfData, id: docRef.id, status: 'Draft', createdAt: dataToSave.createdAt, auditLog: [auditEntry], incidentNumber: '' };
};

export const getActiveDraftsForEvent = async (userId: string, eventId: string): Promise<EPRFForm[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol
        .where('createdBy.uid', '==', userId)
        .where('status', '==', 'Draft');
    const snapshot = await q.get();

    if (snapshot.empty) {
        return [];
    }
    
    const eventDraftDocs = snapshot.docs.filter(doc => doc.data().eventId === eventId);

    return eventDraftDocs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));
};


export const getAllDraftsForUser = async (userId: string): Promise<EPRFForm[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol
        .where('createdBy.uid', '==', userId)
        .where('status', '==', 'Draft');
     const snapshot = await q.get();
    if (snapshot.empty) {
        return [];
    }
    const drafts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));
    // Sort client-side to avoid needing a composite index
    drafts.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    return drafts;
}

export const getEPRFById = async (eprfId: string): Promise<EPRFForm | null> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const docRef = db.doc(`eprfs/${eprfId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return null;
    return { id: docSnap.id, ...docSnap.data() } as EPRFForm;
}

export const updateEPRF = async (eprfId: string, eprfData: EPRFForm): Promise<void> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const docRef = db.doc(`eprfs/${eprfId}`);
    const dataToSave = prepareEPRFForFirebase(eprfData);
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await docRef.update(dataToSave);
};

export const finalizeEPRF = async (eprfId: string, eprfData: EPRFForm): Promise<void> => {
    // 1. Create controlled drug ledger entries if needed
    for (const med of eprfData.medicationsAdministered) {
        if (med.isControlledDrug && med.witness && med.batchNumber) {
            await addLedgerEntry({
                drugName: med.medication as any, // Assuming medication name matches ledger drug names
                batchNumber: med.batchNumber,
                expiryDate: 'N/A', // Not captured in ePRF, might need adjustment
                type: 'Administered',
                patientId: eprfData.patientId!,
                patientName: eprfData.patientName,
                doseAdministered: med.dose,
                user1: eprfData.createdBy,
                user2: med.witness,
                notes: `Administered during ePRF #${eprfData.incidentNumber}`,
            });

            if (med.amountWasted) {
                await addLedgerEntry({
                    drugName: med.medication as any,
                    batchNumber: med.batchNumber,
                    expiryDate: 'N/A',
                    type: 'Wasted',
                    wastedAmount: med.amountWasted,
                    user1: eprfData.createdBy,
                    user2: med.witness,
                    notes: `Wastage from administration in ePRF #${eprfData.incidentNumber}`,
                });
            }
        }
    }

    // 2. Finalize the ePRF document
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const docRef = db.doc(`eprfs/${eprfId}`);
    const dataToSave = prepareEPRFForFirebase(eprfData);
    // Remove audit log from main payload to avoid overwriting it when using arrayUnion
    delete (dataToSave as any).auditLog;

    const auditEntry: AuditEntry = {
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
        timestamp: firebase.firestore.Timestamp.now(),
        user: eprfData.createdBy,
        action: 'Submitted for Review'
    };
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await docRef.update({
        ...dataToSave,
        status: 'Pending Review' as const,
        auditLog: firebase.firestore.FieldValue.arrayUnion(auditEntry)
    });
};


export const deleteEPRF = async (eprfId: string): Promise<void> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await db.doc(`eprfs/${eprfId}`).delete();
};


export const getEPRFsForPatient = async (patientId: string, user: AppUser): Promise<EPRFForm[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const eprfsCol = db.collection('eprfs');
    const isManager = user.role === 'Manager' || user.role === 'Admin';
    let q;

    if (isManager) {
        // Managers can see all ePRFs for a patient. This query relies on rules allowing broad access for managers.
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
        q = eprfsCol.where('patientId', '==', patientId);
    } else {
        // Non-managers can only see ePRFs for this patient that they created.
        // This is a more secure query that works with the existing rules for all users.
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
        q = eprfsCol 
            .where('patientId', '==', patientId)
            .where('createdBy.uid', '==', user.uid);
    }

    const snapshot = await q.get();
    const eprfs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
    
    // Sort client-side to avoid needing composite indexes
    eprfs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    return eprfs;
};

export const getRecentEPRFsForUser = async (userId: string, limitCount: number = 5): Promise<EPRFForm[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol
        .where('createdBy.uid', '==', userId)
        .where('status', 'in', ['Pending Review', 'Reviewed'])
        .orderBy('createdAt', 'desc')
        .limit(limitCount);
    
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EPRFForm));
}

export const getPendingEPRFs = async (): Promise<EPRFForm[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol.where('status', '==', 'Pending Review');
    const snapshot = await q.get();
    const reviews = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
    // Sort client-side to avoid needing a composite index
    reviews.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    return reviews;
};

export const getAllFinalizedEPRFs = async (): Promise<EPRFForm[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol.where('status', 'in', ['Pending Review', 'Reviewed']);
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const approveEPRF = async (eprfId: string, reviewer: {uid: string, name: string}): Promise<void> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const docRef = db.doc(`eprfs/${eprfId}`);
    const auditEntry: AuditEntry = {
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
        timestamp: firebase.firestore.Timestamp.now(),
        user: reviewer,
        action: 'Reviewed & Approved'
    };
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await docRef.update({
        status: 'Reviewed' as const,
        reviewedBy: { ...reviewer, date: firebase.firestore.Timestamp.now() },
        reviewNotes: firebase.firestore.FieldValue.delete(), // Clear any previous "return to draft" notes
        auditLog: firebase.firestore.FieldValue.arrayUnion(auditEntry)
    });
};

export const returnEPRFToDraft = async (eprfId: string, eprfData: EPRFForm, manager: {uid: string, name: string}, reason: string): Promise<void> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const docRef = db.doc(`eprfs/${eprfId}`);
    const auditEntry: AuditEntry = {
        // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
        timestamp: firebase.firestore.Timestamp.now(),
        user: manager,
        action: 'Returned for Correction',
        details: reason,
    };
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await docRef.update({
        status: 'Draft' as const,
        reviewNotes: reason,
        auditLog: firebase.firestore.FieldValue.arrayUnion(auditEntry)
    });
    // Notification is now handled by a cloud function.
}

export const getEPRFsToSyncSignatures = async (userId: string): Promise<EPRFForm[]> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const eprfsCol = db.collection('eprfs');
    const q = eprfsCol
        .where('createdBy.uid', '==', userId) 
        .where('signaturesNeedSync', '==', true);
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EPRFForm));
};

export const updateSyncedSignatures = async (eprfId: string, updates: { clinicianSignatureUrl?: string, patientSignatureUrl?: string }): Promise<void> => {
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    const docRef = db.doc(`eprfs/${eprfId}`);
    // FIX: Replaced all modular Firestore imports and function calls with their compat equivalents (e.g., db.collection(...).get(), firebase.firestore.Timestamp) to resolve type errors and align with the application's Firebase setup.
    await docRef.update({
        ...updates,
        signaturesNeedSync: firebase.firestore.FieldValue.delete()
    });
};