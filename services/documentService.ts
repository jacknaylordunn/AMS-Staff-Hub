import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { CompanyDocument } from '../types';

// Document Functions
export const getDocuments = async (): Promise<CompanyDocument[]> => {
    const docsCol = firestore.collection(db, 'documents');
    const snapshot = await firestore.getDocs(firestore.query(docsCol, firestore.orderBy('title')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CompanyDocument));
};
export const createDocument = async (docData: Omit<CompanyDocument, 'id'>): Promise<void> => {
    await firestore.addDoc(firestore.collection(db, 'documents'), docData);
}
export const deleteDocument = async (docId: string): Promise<void> => {
    await firestore.deleteDoc(firestore.doc(db, 'documents', docId));
}
