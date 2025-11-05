import { collection, getDocs, addDoc, deleteDoc, query, orderBy, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { CompanyDocument } from '../types';

// Document Functions
export const getDocuments = async (): Promise<CompanyDocument[]> => {
    const docsCol = collection(db, 'documents');
    const snapshot = await getDocs(query(docsCol, orderBy('title')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CompanyDocument));
};
export const createDocument = async (docData: Omit<CompanyDocument, 'id'>): Promise<void> => {
    await addDoc(collection(db, 'documents'), docData);
}
export const deleteDocument = async (docId: string): Promise<void> => {
    await deleteDoc(doc(db, 'documents', docId));
}
