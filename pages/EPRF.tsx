import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { getActiveDraftsForEvent, createDraftEPRF } from '../services/eprfService';
import { getInitialFormState } from '../utils/eprfHelpers';
import EPRFForm from '../components/EPRFForm';
import { SpinnerIcon } from '../components/icons';
import { showToast } from '../components/Toast';

export const EPRF: React.FC = () => {
    const { user } = useAuth();
    const { activeEvent, openEPRFDrafts, setOpenEPRFDrafts, activeEPRFId, setActiveEPRFId } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);

    const loadDrafts = useCallback(async () => {
        if (!user || !activeEvent) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const drafts = await getActiveDraftsForEvent(user.uid, activeEvent.id!);
            if (drafts.length > 0) {
                setOpenEPRFDrafts(drafts);
                // If no draft is active or the active one is not in the list, activate the first one
                if (!activeEPRFId || !drafts.some(d => d.id === activeEPRFId)) {
                    setActiveEPRFId(drafts[0].id!);
                }
            } else {
                // No drafts exist for this event, so clear the context
                setOpenEPRFDrafts([]);
                setActiveEPRFId(null);
            }
        } catch (error) {
            showToast("Failed to load ePRF drafts.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [user, activeEvent, setOpenEPRFDrafts, setActiveEPRFId, activeEPRFId]);

    useEffect(() => {
        // Load drafts only if they haven't been loaded for this event yet, or if the context is empty
        if (activeEvent && (openEPRFDrafts.length === 0 || openEPRFDrafts.every(d => d.eventId !== activeEvent.id))) {
            loadDrafts();
        } else {
            setIsLoading(false);
        }
    }, [activeEvent, loadDrafts, openEPRFDrafts]);
    
    // This is the key change to prevent flicker.
    // We filter the drafts from context to only include ones for the current event *before* rendering.
    const activeDraft = useMemo(() => {
        if (!activeEvent) return undefined;
        return openEPRFDrafts.find(d => d.id === activeEPRFId && d.eventId === activeEvent.id);
    }, [activeEvent, openEPRFDrafts, activeEPRFId]);


    if (!activeEvent) {
        return (
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">No Active Event</p>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Please log on to an event from the Duty Logon page to start an ePRF.</p>
            </div>
        );
    }

    if (isLoading) {
        return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /></div>;
    }

    if (!activeDraft) {
        return (
             <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">No Active Patient Report</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                    To begin, please create a new ePRF using the '+' button in the tabs above.
                </p>
            </div>
        );
    }
    
    return <EPRFForm key={activeDraft.id} initialEPRFData={activeDraft} />;
};

export default EPRF;