import * as firestore from 'firebase/firestore';
import { db } from './firebase';
import type { User, ComplianceDocument } from '../types';

// User Profile Functions
export const createUserProfile = async (uid: string, data: { email: string; firstName: string; lastName: string; registrationNumber?: string }) => {
  await firestore.setDoc(firestore.doc(db, 'users', uid), {
    ...data,
    role: 'Pending', // All new users must be approved by a manager
    createdAt: firestore.Timestamp.now(),
  });
};

export const getUserProfile = async (uid:string): Promise<User | null> => {
  const docRef = firestore.doc(db, 'users', uid);
  const docSnap = await firestore.getDoc(docRef);
  if (docSnap.exists()) {
    return { uid, ...docSnap.data() } as User;
  }
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<Omit<User, 'uid' | 'email'>>) => {
  const userRef = firestore.doc(db, 'users', uid);
  await firestore.updateDoc(userRef, data);
};

export const addComplianceDocumentToUser = async (uid: string, newDocument: ComplianceDocument) => {
    const userRef = firestore.doc(db, 'users', uid);
    await firestore.updateDoc(userRef, {
        complianceDocuments: firestore.arrayUnion(newDocument)
    });
};

export const deleteUserProfile = async (uid: string): Promise<void> => {
    const userRef = firestore.doc(db, 'users', uid);
    await firestore.deleteDoc(userRef);
    // Note: This does not delete the user from Firebase Authentication.
    // A cloud function would be required for that. For now, this effectively
    // blocks them from using the app.
};

export const getUsers = async (): Promise<User[]> => {
    const usersCol = firestore.collection(db, 'users');
    const snapshot = await firestore.getDocs(firestore.query(usersCol, firestore.orderBy('lastName')));
    return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
};

export const listenToUsers = (callback: (users: User[]) => void): () => void => {
    const q = firestore.query(firestore.collection(db, 'users'), firestore.orderBy('lastName'));
    return firestore.onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
        callback(users);
    }, (error) => console.error("Error listening to users:", error));
};

export const requestRoleChange = async (uid: string, newRole: User['role']) => {
    const userRef = firestore.doc(db, 'users', uid);
    await firestore.updateDoc(userRef, { pendingRole: newRole });
    // Notifications are now handled by a cloud function.
};

export const approveRoleChange = async (uid: string, newRole: User['role']) => {
    const userRef = firestore.doc(db, 'users', uid);
    await firestore.updateDoc(userRef, {
        role: newRole,
        pendingRole: firestore.deleteField()
    });
    // Notification is now handled by a cloud function.
};

export const rejectRoleChange = async (uid: string) => {
    const userRef = firestore.doc(db, 'users', uid);
    await firestore.updateDoc(userRef, {
        pendingRole: firestore.deleteField()
    });
    // Notification is now handled by a cloud function.
};