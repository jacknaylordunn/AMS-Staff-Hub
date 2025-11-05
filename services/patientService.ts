import { collection, doc, addDoc, getDoc, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Patient } from '../types';

// Patient Functions
export const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'patients'), {
        ...patientData,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export const getPatientById = async (patientId: string): Promise<Patient | null> => {
    const docRef = doc(db, 'patients', patientId);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()){
        return { id: docSnap.id, ...docSnap.data() } as Patient;
    }
    return null;
}

export const getPatients = async (searchTerm: string = ''): Promise<Patient[]> => {
    const patientsCol = collection(db, 'patients');
    // Note: Firestore does not support native text search. For scalability, a dedicated search service
    // like Algolia or Elasticsearch is recommended. This implementation fetches a limited set and filters client-side.
    const q = query(patientsCol, orderBy('lastName'), limit(50));
    const snapshot = await getDocs(q);
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
    const patientsCol = collection(db, 'patients');
    const q = query(patientsCol, orderBy('lastName'));
    const snapshot = await getDocs(q);
    const patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
    
    return patients.filter(p => 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.dob.includes(searchTerm.toLowerCase())
    );
}
