import React, { useEffect, useState, useCallback } from 'react';
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
                setActiveEPRFId(drafts[0].id!);
            } else {
                // No drafts exist, create a new one
                const newDraft = await createDraftEPRF(getInitialFormState(activeEvent, user));
                setOpenEPRFDrafts([newDraft]);
                setActiveEPRFId(newDraft.id!);
            }
        } catch (error) {
            showToast("Failed to load ePRF drafts.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [user, activeEvent, setOpenEPRFDrafts, setActiveEPRFId]);

    useEffect(() => {
        // Load drafts only if they haven't been loaded for this event yet, or if the context is empty
        if (activeEvent && (openEPRFDrafts.length === 0 || openEPRFDrafts.every(d => d.eventId !== activeEvent.id))) {
            loadDrafts();
        } else {
            // if drafts are already in context for this event, ensure one is active
            if(activeEvent && openEPRFDrafts.length > 0 && !activeEPRFId) {
                setActiveEPRFId(openEPRFDrafts[0].id!);
            }
            setIsLoading(false);
        }
    }, [activeEvent, loadDrafts, openEPRFDrafts, activeEPRFId, setActiveEPRFId]);

    const activeDraft = openEPRFDrafts.find(d => d.id === activeEPRFId);

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
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">No Active Report</p>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Create a new patient report using the '+' button in the tabs above.</p>
            </div>
        );
    }
    
    return <EPRFForm key={activeDraft.id} initialEPRFData={activeDraft} />;
};

export default EPRF;