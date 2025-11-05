import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, orderBy, limit, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Vehicle, VehicleCheck } from '../types';


// Vehicle/Asset Functions
export const getVehicles = async (): Promise<Vehicle[]> => {
    const snapshot = await getDocs(query(collection(db, 'vehicles'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
}

export const getVehicleById = async (vehicleId: string): Promise<Vehicle | null> => {
    const docRef = doc(db, 'vehicles', vehicleId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Vehicle;
}

export const addVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'lastCheck'>): Promise<void> => {
    const docRef = await addDoc(collection(db, 'vehicles'), {
        ...vehicleData,
        createdAt: Timestamp.now(),
    });
    // Add the generated QR code value back to the doc
    const qrCodeValue = `aegis-vehicle-qr:${docRef.id}`;
    await updateDoc(docRef, { qrCodeValue });
}

export const updateVehicle = async (vehicleId: string, vehicleData: Partial<Omit<Vehicle, 'id'>>): Promise<void> => {
    await updateDoc(doc(db, 'vehicles', vehicleId), vehicleData);
}

export const deleteVehicle = async (vehicleId: string): Promise<void> => {
    await deleteDoc(doc(db, 'vehicles', vehicleId));
}

export const getVehicleChecks = async(vehicleId: string): Promise<VehicleCheck[]> => {
    const checksCol = collection(db, 'vehicles', vehicleId, 'checks');
    const q = query(checksCol, orderBy('date', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VehicleCheck));
}

export const addVehicleCheck = async (vehicleId: string, checkData: Omit<VehicleCheck, 'id' | 'date'>): Promise<void> => {
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    const checksCol = collection(vehicleRef, 'checks');

    const now = Timestamp.now();
    
    const batch = writeBatch(db);

    // Add the check document
    batch.set(doc(checksCol), {
        ...checkData,
        date: now,
    });

    // Update the parent vehicle's lastCheck status
    batch.update(vehicleRef, {
        'lastCheck.date': now,
        'lastCheck.user': checkData.user,
        'lastCheck.status': checkData.overallStatus,
        status: checkData.overallStatus === 'Issues Found' ? 'Maintenance Required' : 'In Service'
    });

    await batch.commit();
};