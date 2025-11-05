

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';
import { getDocuments } from '../services/documentService';
import { getEvents } from '../services/eventService';
import { getUsers } from '../services/userService';
import { getShiftsForUser } from '../services/rotaService';
import { getEPRFsToSyncSignatures, updateSyncedSignatures } from '../services/eprfService';
import { uploadFile } from '../services/storageService';
import { showToast } from '../components/Toast';

// This context and provider don't hold state, they're just for triggering side effects.
const DataSyncContext = createContext<void>(undefined);

const dataURLtoBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error("Invalid data URL");
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

const useDataSync = () => {
    const { user, isManager } = useAuth();
    const { isOnline } = useOnlineStatus();

    useEffect(() => {
        // Only sync if online and logged in.
        if (!isOnline || !user) {
            return;
        }

        const syncOfflineData = async () => {
            console.log("Data Sync Service: Checking for offline data to sync...");

            // Sync Signatures
            try {
                const eprfsToSync = await getEPRFsToSyncSignatures(user.uid);
                if (eprfsToSync.length > 0) {
                    showToast(`Syncing ${eprfsToSync.length} offline signature(s)...`, 'info');
                    for (const eprf of eprfsToSync) {
                        const updates: { clinicianSignatureUrl?: string, patientSignatureUrl?: string } = {};
                        
                        if (eprf.clinicianSignatureUrl?.startsWith('data:image')) {
                            const blob = dataURLtoBlob(eprf.clinicianSignatureUrl);
                            const filePath = `signatures/${eprf.id}/clinician_${Date.now()}.png`;
                            updates.clinicianSignatureUrl = await uploadFile(blob, filePath);
                        }
                        
                        if (eprf.patientSignatureUrl?.startsWith('data:image')) {
                            const blob = dataURLtoBlob(eprf.patientSignatureUrl);
                            const filePath = `signatures/${eprf.id}/patient_${Date.now()}.png`;
                            updates.patientSignatureUrl = await uploadFile(blob, filePath);
                        }

                        if (Object.keys(updates).length > 0) {
                            await updateSyncedSignatures(eprf.id!, updates);
                        } else {
                             // If no data URLs found, just mark it as synced to prevent re-fetching
                            await updateSyncedSignatures(eprf.id!, {});
                        }
                    }
                    showToast('Offline signatures synced successfully!', 'success');
                }
            } catch (error) {
                console.error("Data Sync Service: Failed to sync signatures.", error);
                showToast("Failed to sync some offline data.", "error");
            }
            
            // Pre-caching logic
            console.log("Data Sync Service: Pre-caching data for offline use...");
            try {
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

        syncOfflineData();

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