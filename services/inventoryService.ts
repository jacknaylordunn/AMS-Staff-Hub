import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { Kit, KitCheck } from '../types';
import { DEFAULT_KIT_CHECKLISTS } from '../types';

// Kit Functions
export const getKits = async (): Promise<Kit[]> => {
    const snapshot = await db.collection('kits').orderBy('name').get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kit));
};

export const listenToKits = (callback: (kits: Kit[]) => void): () => void => {
    const q = db.collection('kits').orderBy('name');
    return q.onSnapshot((snapshot) => {
        const kits = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kit));
        callback(kits);
    }, (error) => console.error("Error listening to kits:", error));
};

export const getKitById = async (kitId: string): Promise<Kit | null> => {
    const docRef = db.doc(`kits/${kitId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return null;
    return { id: docSnap.id, ...docSnap.data() } as Kit;
};

export const addKit = async (kitData: Omit<Kit, 'id' | 'createdAt' | 'lastCheck' | 'assignedTo'>): Promise<string> => {
    const defaultChecklist = DEFAULT_KIT_CHECKLISTS[kitData.type] || [];
    const docRef = await db.collection('kits').add({
        ...kitData,
        createdAt: firebase.firestore.Timestamp.now(),
        checklistItems: defaultChecklist,
    });
    // Add the generated QR code value back to the doc
    const qrCodeValue = `aegis-kit-qr:${docRef.id}`;
    await docRef.update({ qrCodeValue });
    return docRef.id;
};

export const updateKit = async (kitId: string, kitData: Partial<Omit<Kit, 'id'>>): Promise<void> => {
    await db.doc(`kits/${kitId}`).update(kitData);
};

export const deleteKit = async (kitId: string): Promise<void> => {
    await db.doc(`kits/${kitId}`).delete();
};

// Kit Check Functions
export const getKitChecks = async (kitId: string): Promise<KitCheck[]> => {
    const checksCol = db.collection('kits').doc(kitId).collection('checks');
    const q = checksCol.orderBy('date', 'desc').limit(20);
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KitCheck));
};

export const addKitCheck = async (kitId: string, checkData: Omit<KitCheck, 'id' | 'date'>): Promise<void> => {
    const kitRef = db.doc(`kits/${kitId}`);
    const checksCol = kitRef.collection('checks');
    const now = firebase.firestore.Timestamp.now();
    
    const batch = db.batch();

    // Add the check document
    const newCheckRef = checksCol.doc();
    batch.set(newCheckRef, {
        ...checkData,
        date: now,
    });
    
    // Determine new kit status and assignment
    let newStatus: Kit['status'] = 'In Service';
    let assignedTo: Kit['assignedTo'] | null = null;
    if (checkData.type === 'Sign Out') {
        newStatus = 'With Crew';
        assignedTo = checkData.user;
    } else if (checkData.type === 'Sign In') {
        newStatus = (checkData.itemsUsed && checkData.itemsUsed.length > 0) || checkData.overallStatus === 'Issues Found' ? 'Needs Restocking' : 'In Service';
    }
    
    // Extract new expiry/batch data to update on the main kit document
    const newTrackedItems = checkData.checkedItems
        .filter(item => item.expiryDate || item.batchNumber)
        .map(({ itemName, expiryDate, batchNumber }) => ({ itemName, expiryDate, batchNumber }));


    // Update the parent kit's status and lastCheck info
    const updatePayload: any = {
        lastCheck: {
            date: now,
            user: checkData.user,
            status: checkData.overallStatus,
        },
        status: newStatus,
        trackedItems: newTrackedItems,
        assignedTo: assignedTo === null ? firebase.firestore.FieldValue.delete() : assignedTo,
    };

    batch.update(kitRef, updatePayload);
    await batch.commit();
};