import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { Patient } from '../types';

// Patient Functions
export const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await firestore.addDoc(firestore.collection(db, 'patients'), {
        ...patientData,
        createdAt: firestore.Timestamp.now(),
    });
    return docRef.id;
}

export const getPatientById = async (patientId: string): Promise<Patient | null> => {
    const docRef = firestore.doc(db, 'patients', patientId);
    const docSnap = await firestore.getDoc(docRef);
    if(docSnap.exists()){
        return { id: docSnap.id, ...docSnap.data() } as Patient;
    }
    return null;
}

export const getPatients = async (searchTerm: string = ''): Promise<Patient[]> => {
    const patientsCol = firestore.collection(db, 'patients');
    // Note: Firestore does not support native text search. For scalability, a dedicated search service
    // like Algolia or Elasticsearch is recommended. This implementation fetches a limited set and filters client-side.
    const q = firestore.query(patientsCol, firestore.orderBy('lastName'), firestore.limit(50));
    const snapshot = await firestore.getDocs(q);
    const patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
    
    if (searchTerm) {
        return patients.filter(p => 
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.dob.includes(searchTerm)
        );
    }
    return patients;
}

export const searchPatients = async (searchTerm: string): Promise<Patient[]> => {
    if(!searchTerm) return [];
    // This is a simplified client-side search and will not scale well with a large patient database.
    // A proper implementation would use a dedicated search service.
    const patientsCol = firestore.collection(db, 'patients');
    const q = firestore.query(patientsCol, firestore.orderBy('lastName'), firestore.limit(100));
    const snapshot = await firestore.getDocs(q);
    const patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
    
    return patients.filter(p => 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.dob.includes(searchTerm.toLowerCase())
    ).slice(0, 10);
}
