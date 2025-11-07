// FIX: The errors indicate members are not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { Kit, KitCheck } from '../types';
import { DEFAULT_KIT_CHECKLISTS } from '../types';

// Kit Functions
export const getKits = async (): Promise<Kit[]> => {
    const snapshot = await firestore.getDocs(firestore.query(firestore.collection(db, 'kits'), firestore.orderBy('name')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kit));
};

export const listenToKits = (callback: (kits: Kit[]) => void): () => void => {
    const q = firestore.query(firestore.collection(db, 'kits'), firestore.orderBy('name'));
    return firestore.onSnapshot(q, (snapshot) => {
        const kits = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kit));
        callback(kits);
    }, (error) => console.error("Error listening to kits:", error));
};

export const getKitById = async (kitId: string): Promise<Kit | null> => {
    const docRef = firestore.doc(db, 'kits', kitId);
    const docSnap = await firestore.getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Kit;
};

export const addKit = async (kitData: Omit<Kit, 'id' | 'createdAt' | 'lastCheck'>): Promise<string> => {
    const defaultChecklist = DEFAULT_KIT_CHECKLISTS[kitData.type] || [];
    const docRef = await firestore.addDoc(firestore.collection(db, 'kits'), {
        ...kitData,
        createdAt: firestore.Timestamp.now(),
        checklistItems: defaultChecklist,
    });
    // Add the generated QR code value back to the doc
    const qrCodeValue = `aegis-kit-qr:${docRef.id}`;
    await firestore.updateDoc(docRef, { qrCodeValue });
    return docRef.id;
};

export const updateKit = async (kitId: string, kitData: Partial<Omit<Kit, 'id'>>): Promise<void> => {
    await firestore.updateDoc(firestore.doc(db, 'kits', kitId), kitData);
};

export const deleteKit = async (kitId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'kits', kitId));
};

// Kit Check Functions
export const getKitChecks = async (kitId: string): Promise<KitCheck[]> => {
    const checksCol = firestore.collection(db, 'kits', kitId, 'checks');
    const q = firestore.query(checksCol, firestore.orderBy('date', 'desc'), firestore.limit(20));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KitCheck));
};

export const addKitCheck = async (kitId: string, checkData: Omit<KitCheck, 'id' | 'date'>): Promise<void> => {
    const kitRef = firestore.doc(db, 'kits', kitId);
    const checksCol = firestore.collection(kitRef, 'checks');
    const now = firestore.Timestamp.now();
    
    const batch = firestore.writeBatch(db);

    // Add the check document
    const newCheckRef = firestore.doc(checksCol);
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
        assignedTo: assignedTo, // This will be null on Sign In, correctly un-assigning it
    };

    batch.update(kitRef, updatePayload);
    await batch.commit();
};