import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { Vehicle, VehicleCheck } from '../types';


// Vehicle/Asset Functions
export const getVehicles = async (): Promise<Vehicle[]> => {
    const snapshot = await firestore.getDocs(firestore.query(firestore.collection(db, 'vehicles'), firestore.orderBy('createdAt', 'desc')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
}

export const listenToVehicles = (callback: (vehicles: Vehicle[]) => void): () => void => {
    const q = firestore.query(firestore.collection(db, 'vehicles'), firestore.orderBy('createdAt', 'desc'));
    return firestore.onSnapshot(q, (snapshot) => {
        const vehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
        callback(vehicles);
    }, (error) => console.error("Error listening to vehicles:", error));
};

export const getVehicleById = async (vehicleId: string): Promise<Vehicle | null> => {
    const docRef = firestore.doc(db, 'vehicles', vehicleId);
    const docSnap = await firestore.getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Vehicle;
}

export const addVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'lastCheck'>): Promise<void> => {
    const docRef = await firestore.addDoc(firestore.collection(db, 'vehicles'), {
        ...vehicleData,
        createdAt: firestore.Timestamp.now(),
    });
    // Add the generated QR code value back to the doc
    const qrCodeValue = `aegis-vehicle-qr:${docRef.id}`;
    await firestore.updateDoc(docRef, { qrCodeValue });
}

export const updateVehicle = async (vehicleId: string, vehicleData: Partial<Omit<Vehicle, 'id'>>): Promise<void> => {
    await firestore.updateDoc(firestore.doc(db, 'vehicles', vehicleId), vehicleData);
}

export const deleteVehicle = async (vehicleId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'vehicles', vehicleId));
}

export const getVehicleChecks = async(vehicleId: string): Promise<VehicleCheck[]> => {
    const checksCol = firestore.collection(db, 'vehicles', vehicleId, 'checks');
    const q = firestore.query(checksCol, firestore.orderBy('date', 'desc'), firestore.limit(20));
    const snapshot = await firestore.getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VehicleCheck));
}

export const addVehicleCheck = async (vehicleId: string, checkData: Omit<VehicleCheck, 'id' | 'date'>): Promise<void> => {
    const vehicleRef = firestore.doc(db, 'vehicles', vehicleId);
    const checksCol = firestore.collection(vehicleRef, 'checks');

    const now = firestore.Timestamp.now();
    
    const batch = firestore.writeBatch(db);

    // Add the check document
    const newCheckRef = firestore.doc(checksCol);
    batch.set(newCheckRef, {
        ...checkData,
        date: now,
    });

    // Update the parent vehicle's lastCheck status and overall status
    const newStatus = checkData.overallStatus === 'Issues Found' ? 'Maintenance Required' : 'In Service';
    batch.update(vehicleRef, {
        lastCheck: {
            date: now,
            user: checkData.user,
            status: checkData.overallStatus,
        },
        status: newStatus
    });

    await batch.commit();
};
