import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, orderBy, limit, Timestamp, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { Kit, KitCheck } from '../types';
import { DEFAULT_KIT_CHECKLISTS } from '../types';

// Kit Functions
export const getKits = async (): Promise<Kit[]> => {
    const snapshot = await getDocs(query(collection(db, 'kits'), orderBy('name')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kit));
};

export const listenToKits = (callback: (kits: Kit[]) => void): () => void => {
    const q = query(collection(db, 'kits'), orderBy('name'));
    return onSnapshot(q, (snapshot) => {
        const kits = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kit));
        callback(kits);
    }, (error) => console.error("Error listening to kits:", error));
};

export const getKitById = async (kitId: string): Promise<Kit | null> => {
    const docRef = doc(db, 'kits', kitId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Kit;
};

export const addKit = async (kitData: Omit<Kit, 'id' | 'createdAt' | 'lastCheck'>): Promise<string> => {
    const defaultChecklist = DEFAULT_KIT_CHECKLISTS[kitData.type] || [];
    const docRef = await addDoc(collection(db, 'kits'), {
        ...kitData,
        createdAt: Timestamp.now(),
        checklistItems: defaultChecklist,
    });
    // Add the generated QR code value back to the doc
    const qrCodeValue = `aegis-kit-qr:${docRef.id}`;
    await updateDoc(docRef, { qrCodeValue });
    return docRef.id;
};

export const updateKit = async (kitId: string, kitData: Partial<Omit<Kit, 'id'>>): Promise<void> => {
    await updateDoc(doc(db, 'kits', kitId), kitData);
};

export const deleteKit = async (kitId: string): Promise<void> => {
    await deleteDoc(doc(db, 'kits', kitId));
};

// Kit Check Functions
export const getKitChecks = async (kitId: string): Promise<KitCheck[]> => {
    const checksCol = collection(db, 'kits', kitId, 'checks');
    const q = query(checksCol, orderBy('date', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KitCheck));
};

export const addKitCheck = async (kitId: string, checkData: Omit<KitCheck, 'id' | 'date'>): Promise<void> => {
    const kitRef = doc(db, 'kits', kitId);
    const checksCol = collection(kitRef, 'checks');
    const now = Timestamp.now();
    
    const batch = writeBatch(db);

    // Add the check document
    batch.set(doc(checksCol), {
        ...checkData,
        date: now,
    });
    
    // Determine new kit status based on check type
    let newStatus: Kit['status'] = 'In Service';
    let assignedTo: Kit['assignedTo'] | null = null;
    if(checkData.type === 'Sign Out') {
        newStatus = 'With Crew';
        assignedTo = checkData.user;
    } else if (checkData.type === 'Sign In') {
        newStatus = (checkData.itemsUsed && checkData.itemsUsed.length > 0) ? 'Needs Restocking' : 'In Service';
        assignedTo = null; // Unassign
    }
    
    // Extract new expiry/batch data to update on the main kit document
    const newTrackedItems = checkData.checkedItems
        .filter(item => item.expiryDate || item.batchNumber)
        .map(({ itemName, expiryDate, batchNumber }) => ({ itemName, expiryDate, batchNumber }));


    // Update the parent kit's status and lastCheck info
    const updatePayload: any = {
        'lastCheck.date': now,
        'lastCheck.user': checkData.user,
        'lastCheck.status': checkData.overallStatus,
        status: newStatus,
        trackedItems: newTrackedItems,
    };
    
    if (checkData.type === 'Sign Out') {
         updatePayload.assignedTo = assignedTo;
    } else if (checkData.type === 'Sign In') {
        updatePayload.assignedTo = null;
    }

    batch.update(kitRef, updatePayload);
    await batch.commit();
};