import { db } from './firebase';
import type { CompanyDocument } from '../types';

// Document Functions
export const getDocuments = async (): Promise<CompanyDocument[]> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection(...).get()) to align with the application's Firebase setup.
    const docsCol = db.collection('documents');
    const snapshot = await docsCol.orderBy('title').get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CompanyDocument));
};
export const createDocument = async (docData: Omit<CompanyDocument, 'id'>): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection(...).get()) to align with the application's Firebase setup.
    await db.collection('documents').add(docData);
}
export const deleteDocument = async (docId: string): Promise<void> => {
    // FIX: Replaced modular Firestore imports and function calls with compat syntax (e.g., db.collection(...).get()) to align with the application's Firebase setup.
    await db.doc(`documents/${docId}`).delete();
}