import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// Fix: Use v8 compatibility API and types
import type firebase from 'firebase/compat/app';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/firestoreService';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isManager: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isManager = user?.role === 'Manager' || user?.role === 'Admin';
  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    // Fix: Use v8 `auth.onAuthStateChanged` method and `firebase.User` type
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: firebase.User | null) => {
      if (firebaseUser) {
        // Fetch profile from Firestore
        const userProfile = await getUserProfile(firebaseUser.uid);
        if (userProfile) {
           setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              firstName: userProfile.firstName,
              lastName: userProfile.lastName,
              role: userProfile.role,
              registrationNumber: userProfile.registrationNumber
           });
        } else {
            // Handle case where auth exists but no profile in DB yet (e.g., during registration)
             setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                // These will be undefined but the type allows it temporarily during signup
                firstName: '',
                lastName: '',
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isManager, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};