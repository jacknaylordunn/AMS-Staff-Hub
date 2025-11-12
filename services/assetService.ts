import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { Vehicle, VehicleCheck } from '../types';


// Vehicle/Asset Functions
export const getVehicles = async (): Promise<Vehicle[]> => {
    const snapshot = await db.collection('vehicles').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
}

export const listenToVehicles = (callback: (vehicles: Vehicle[]) => void): () => void => {
    const q = db.collection('vehicles').orderBy('createdAt', 'desc');
    return q.onSnapshot((snapshot) => {
        const vehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
        callback(vehicles);
    }, (error) => console.error("Error listening to vehicles:", error));
};

export const getVehicleById = async (vehicleId: string): Promise<Vehicle | null> => {
    const docRef = db.doc(`vehicles/${vehicleId}`);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return null;
    return { id: docSnap.id, ...docSnap.data() } as Vehicle;
}

export const addVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'lastCheck'>): Promise<void> => {
    const docRef = await db.collection('vehicles').add({
        ...vehicleData,
        createdAt: firebase.firestore.Timestamp.now(),
    });
    // Add the generated QR code value back to the doc
    const qrCodeValue = `aegis-vehicle-qr:${docRef.id}`;
    await docRef.update({ qrCodeValue });
}

export const updateVehicle = async (vehicleId: string, vehicleData: Partial<Omit<Vehicle, 'id'>>): Promise<void> => {
    await db.doc(`vehicles/${vehicleId}`).update(vehicleData);
}

export const deleteVehicle = async (vehicleId: string): Promise<void> => {
    await db.doc(`vehicles/${vehicleId}`).delete();
}

export const getVehicleChecks = async(vehicleId: string): Promise<VehicleCheck[]> => {
    const checksCol = db.collection('vehicles').doc(vehicleId).collection('checks');
    const q = checksCol.orderBy('date', 'desc').limit(20);
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VehicleCheck));
}

export const addVehicleCheck = async (vehicleId: string, checkData: Omit<VehicleCheck, 'id' | 'date'>): Promise<void> => {
    const vehicleRef = db.doc(`vehicles/${vehicleId}`);
    const checksCol = vehicleRef.collection('checks');

    const now = firebase.firestore.Timestamp.now();
    
    const batch = db.batch();

    // Add the check document
    const newCheckRef = checksCol.doc();
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