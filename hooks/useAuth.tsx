

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as firebaseAuth from 'firebase/auth';
// FIX: Use named imports for modular Firestore SDK.
import { auth, db } from '../services/firebase';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  
  const isManager = user?.role === 'Manager' || user?.role === 'Admin';
  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    let unsubscribeFirestore: () => void | undefined;

    const unsubscribeAuth = firebaseAuth.onAuthStateChanged(auth, (firebaseUser: firebaseAuth.User | null) => {
      // Clean up previous Firestore listener if user changes
      if (unsubscribeFirestore) unsubscribeFirestore();

      if (firebaseUser) {
        setIsEmailVerified(firebaseUser.emailVerified);
        
        // FIX: Use compat 'doc' function.
        const userDocRef = db.doc(`users/${firebaseUser.uid}`);
        
        // FIX: Use compat 'onSnapshot' function.
        unsubscribeFirestore = userDocRef.onSnapshot((docSnap) => {
            if (docSnap.exists) {
                const userProfile = docSnap.data();
                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    ...userProfile,
                } as User);
            } else {
                 // This case can happen during registration before profile is created
                 setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    firstName: firebaseUser.displayName?.split(' ')[0] || '',
                    lastName: firebaseUser.displayName?.split(' ')[1] || '',
                    role: 'Pending'
                });
            }
            setLoading(false);
        }, (error) => {
            console.error("Auth profile listener error:", error);
            setUser(null);
            setLoading(false);
        });

      } else {
        setUser(null);
        setIsEmailVerified(false);
        setLoading(false);
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isManager, isAdmin, isEmailVerified }}>
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
