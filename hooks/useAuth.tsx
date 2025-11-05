import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/userService';
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setIsEmailVerified(firebaseUser.emailVerified);
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
        setIsEmailVerified(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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