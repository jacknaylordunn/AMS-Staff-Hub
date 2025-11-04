import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';
import { getDocuments, getEvents, getUsers, getShiftsForUser } from '../services/firestoreService';

// This context and provider don't hold state, they're just for triggering side effects.
const DataSyncContext = createContext<void>(undefined);

const useDataSync = () => {
    const { user, isManager } = useAuth();
    const { isOnline } = useOnlineStatus();

    useEffect(() => {
        // Only sync if online and logged in.
        if (!isOnline || !user) {
            return;
        }

        const syncData = async () => {
            console.log("Data Sync Service: Pre-caching data for offline use...");
            try {
                // These calls will populate the Firestore offline cache.
                await getDocuments();
                await getEvents();
                
                if (isManager) {
                    await getUsers();
                }

                if (user) {
                    const now = new Date();
                    // Cache current and next month's shifts for the user.
                    await getShiftsForUser(user.uid, now.getFullYear(), now.getMonth());
                    await getShiftsForUser(user.uid, now.getFullYear(), now.getMonth() + 1);
                }
                console.log("Data Sync Service: Caching complete.");
            } catch (error) {
                console.error("Data Sync Service: Failed to pre-cache data.", error);
            }
        };

        // Run sync on initial load and when user/online status changes.
        syncData();

    }, [user, isOnline, isManager]);
};


export const DataSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    useDataSync(); // The hook runs its effects within the provider.
    return (
        <DataSyncContext.Provider value={undefined}>
            {children}
        </DataSyncContext.Provider>
    );
};

export const useDataSyncContext = (): void => {
  const context = useContext(DataSyncContext);
  if (context === undefined) {
    throw new Error('useDataSyncContext must be used within a DataSyncProvider');
  }
  return context;
};