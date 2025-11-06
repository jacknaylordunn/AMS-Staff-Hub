import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { getAllDraftsForUser, createDraftEPRF } from '../services/eprfService';
import { getInitialFormState } from '../utils/eprfHelpers';
import EPRFForm from '../components/EPRFForm';
import { SpinnerIcon, EprfIcon } from '../components/icons';
import { showToast } from '../components/Toast';

export const EPRF: React.FC = () => {
    const { user } = useAuth();
    const { 
        activeEvent,
        openEPRFDrafts,
        addEPRFDraft,
        activeEPRFId,
        setActiveEPRFId,
        removeEPRFDraft
    } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;

        const loadAndManageDrafts = async () => {
            setIsLoading(true);
            try {
                const drafts = await getAllDraftsForUser(user.uid);
                
                if (drafts.length > 0) {
                    drafts.forEach(addEPRFDraft);
                    if (!activeEPRFId) {
                        setActiveEPRFId(drafts[0].id!);
                    }
                } else {
                    if (!activeEvent) {
                        // No drafts and not on duty, can't start a new one.
                        // The UI will show a prompt in this case.
                    } else {
                        // On duty but no drafts, create one automatically.
                        const newDraft = await createDraftEPRF(getInitialFormState(activeEvent, user));
                        addEPRFDraft(newDraft);
                        setActiveEPRFId(newDraft.id!);
                    }
                }
            } catch (error) {
                showToast("Failed to load ePRF drafts.", "error");
            } finally {
                setIsLoading(false);
            }
        };

        loadAndManageDrafts();

        // On unmount, clear drafts from context to ensure they are fresh on next visit.
        return () => {
            openEPRFDrafts.forEach(draft => removeEPRFDraft(draft.id!));
            setActiveEPRFId(null);
        }
    }, [user, activeEvent]);

    const handleCloseForm = (formId: string) => {
        if (openEPRFDrafts.length <= 1) {
            // If it's the last one, just clear it and show the start screen
            removeEPRFDraft(formId);
            setActiveEPRFId(null);
        } else {
            const draftIndex = openEPRFDrafts.findIndex(d => d.id === formId);
            const nextDraft = openEPRFDrafts[draftIndex - 1] || openEPRFDrafts[draftIndex + 1];
            setActiveEPRFId(nextDraft.id!);
            removeEPRFDraft(formId);
        }
    };
    
    const activeDraft = openEPRFDrafts.find(d => d.id === activeEPRFId);
    
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <SpinnerIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading ePRF Workspace...</p>
            </div>
        );
    }
    
    if (!activeEvent && openEPRFDrafts.length === 0) {
         return (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <EprfIcon className="w-16 h-16 text-gray-300 dark:text-gray-600"/>
                <h2 className="mt-4 text-2xl font-bold text-gray-800 dark:text-gray-200">Duty Logon Required</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">You must log on to a duty or event before you can create a new ePRF.</p>
                <button
                    onClick={() => navigate('/events')}
                    className="mt-6 px-6 py-3 bg-ams-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90"
                >
                    Go to Duty Logon
                </button>
            </div>
        );
    }

    if (activeDraft) {
        return <EPRFForm initialEPRFData={activeDraft} onComplete={() => handleCloseForm(activeDraft.id!)} />;
    }
    
    return (
         <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <SpinnerIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Preparing new ePRF...</p>
        </div>
    );
};
