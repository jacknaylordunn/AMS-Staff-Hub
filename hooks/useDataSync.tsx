import React, { createContext, useContext, useEffect, ReactNode, useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';
import { getDocuments } from '../services/documentService';
import { getUsers } from '../services/userService';
import { getShiftsForUser } from '../services/rotaService';
import { getEPRFsToSyncSignatures, updateSyncedSignatures } from '../services/eprfService';
import { uploadFile } from '../services/storageService';
import { showToast } from '../components/Toast';

interface DataSyncContextType {
    isSyncing: boolean;
    syncNow: () => Promise<void>;
}

const DataSyncContext = createContext<DataSyncContextType | undefined>(undefined);


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

export const DataSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isManager } = useAuth();
    const { isOnline } = useOnlineStatus();
    const [isSyncing, setIsSyncing] = useState(false);

    const syncNow = useCallback(async () => {
        if (!isOnline || !user) {
            showToast("Cannot sync while offline.", "info");
            return;
        }

        setIsSyncing(true);
        console.log("Data Sync Service: Manual sync triggered...");

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
            await Promise.all([
                getDocuments(),
                isManager ? getUsers() : Promise.resolve(),
                (async () => {
                    if (user) {
                        const now = new Date();
                        await getShiftsForUser(user.uid, now.getFullYear(), now.getMonth());
                        await getShiftsForUser(user.uid, now.getFullYear(), now.getMonth() + 1);
                    }
                })()
            ]);
            console.log("Data Sync Service: Caching complete.");
            showToast("Offline data refreshed.", "success");
        } catch (error) {
            console.error("Data Sync Service: Failed to pre-cache data.", error);
            showToast("Failed to refresh some offline data.", "error");
        } finally {
            setIsSyncing(false);
        }
    }, [user, isOnline, isManager]);

    useEffect(() => {
        if (isOnline && user) {
            syncNow();
        }
    }, [isOnline, user]); // Run once on initial load/reconnect

    return (
        <DataSyncContext.Provider value={{ isSyncing, syncNow }}>
            {children}
        </DataSyncContext.Provider>
    );
};

export const useDataSync = (): DataSyncContextType => {
  const context = useContext(DataSyncContext);
  if (context === undefined) {
    throw new Error('useDataSync must be used within a DataSyncProvider');
  }
  return context;
};