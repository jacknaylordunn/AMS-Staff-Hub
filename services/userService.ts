import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { User } from '../types';
import { createNotification } from './notificationService';

// User Profile Functions
export const createUserProfile = async (uid: string, data: { email: string; firstName: string; lastName: string; registrationNumber?: string }) => {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    role: 'Pending', // All new users must be approved by a manager
    createdAt: Timestamp.now(),
  });
};

export const getUserProfile = async (uid:string): Promise<User | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { uid, ...docSnap.data() } as User;
  }
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<Omit<User, 'uid' | 'email'>>) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);
};

export const getUsers = async (): Promise<User[]> => {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(query(usersCol, orderBy('lastName')));
    return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
};

export const requestRoleChange = async (uid: string, newRole: User['role']) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { pendingRole: newRole });
    
    // Notify managers
    const users = await getUsers();
    const managers = users.filter(u => u.role === 'Manager' || u.role === 'Admin');
    const currentUser = users.find(u => u.uid === uid);

    for (const manager of managers) {
        await createNotification(
            manager.uid,
            `${currentUser?.firstName} ${currentUser?.lastName} has requested a role change to ${newRole}.`,
            '/staff'
        );
    }
};

export const approveRoleChange = async (uid: string, newRole: User['role']) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        role: newRole,
        pendingRole: null // Or use deleteField()
    });
    await createNotification(uid, `Your role has been updated to ${newRole}.`, '/profile');
};

export const rejectRoleChange = async (uid: string) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        pendingRole: null // Or use deleteField()
    });
     await createNotification(uid, `Your recent role change request was not approved.`, '/profile');
};