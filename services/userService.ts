import firebase from 'firebase/compat/app';
import { db, functions } from './firebase';
import type { User, ComplianceDocument } from '../types';

// User Profile Functions
export const createUserProfile = async (uid: string, data: { email: string; firstName: string; lastName: string; registrationNumber?: string }) => {
  await db.doc(`users/${uid}`).set({
    ...data,
    role: 'Pending', // All new users must be approved by a manager
    createdAt: firebase.firestore.Timestamp.now(),
  });
};

export const getUserProfile = async (uid:string): Promise<User | null> => {
  const docRef = db.doc(`users/${uid}`);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    return { uid, ...docSnap.data() } as User;
  }
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<Omit<User, 'uid' | 'email'>>) => {
  const userRef = db.doc(`users/${uid}`);
  await userRef.update(data);
};

export const addComplianceDocumentToUser = async (uid: string, newDocument: ComplianceDocument) => {
    const userRef = db.doc(`users/${uid}`);
    await userRef.update({
        complianceDocuments: firebase.firestore.FieldValue.arrayUnion(newDocument)
    });
};

export const deleteUser = async (uid: string): Promise<{success: boolean; message: string}> => {
    const deleteUserFn = functions.httpsCallable('deleteUserAndData');
    const result = await deleteUserFn({ uid });
    return result.data as {success: boolean; message: string};
};

export const getUsers = async (): Promise<User[]> => {
    const usersCol = db.collection('users');
    const snapshot = await usersCol.orderBy('lastName').get();
    return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
};

export const getSeniorClinicians = async (): Promise<User[]> => {
    const getSeniorCliniciansFn = functions.httpsCallable('getSeniorClinicians');
    const result = await getSeniorCliniciansFn();
    const data = result.data as { clinicians: User[] };
    return data.clinicians;
};

export const getStaffListForKudos = async (): Promise<User[]> => {
    const getStaffFn = functions.httpsCallable('getStaffListForKudos');
    const result = await getStaffFn();
    const data = result.data as { staff: User[] };
    return data.staff;
};

export const listenToUsers = (callback: (users: User[]) => void): () => void => {
    const q = db.collection('users').orderBy('lastName');
    return q.onSnapshot((snapshot) => {
        const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
        callback(users);
    }, (error) => console.error("Error listening to users:", error));
};

export const requestRoleChange = async (uid: string, newRole: User['role']) => {
    const userRef = db.doc(`users/${uid}`);
    await userRef.update({ pendingRole: newRole });
    // Notifications are now handled by a cloud function.
};

export const approveRoleChange = async (uid: string, newRole: User['role']) => {
    const userRef = db.doc(`users/${uid}`);
    await userRef.update({
        role: newRole,
        pendingRole: firebase.firestore.FieldValue.delete()
    });
    // Notification is now handled by a cloud function.
};

export const rejectRoleChange = async (uid: string) => {
    const userRef = db.doc(`users/${uid}`);
    await userRef.update({
        pendingRole: firebase.firestore.FieldValue.delete()
    });
    // Notification is now handled by a cloud function.
};

export const saveFCMToken = async (uid: string, token: string) => {
    const userRef = db.doc(`users/${uid}`);
    await userRef.update({
        fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
    });
};

export const removeFCMToken = async (uid: string, token: string) => {
    const userRef = db.doc(`users/${uid}`);
    await userRef.update({
        fcmTokens: firebase.firestore.FieldValue.arrayRemove(token)
    });
};