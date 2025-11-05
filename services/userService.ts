import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { User } from '../types';

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