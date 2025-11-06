import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { getAllDraftsForUser, createDraftEPRF } from '../services/eprfService';
import { getInitialFormState } from '../utils/eprfHelpers';
import EPRFForm from '../components/EPRFForm';
import { SpinnerIcon, EprfIcon } from '../components/icons';
import { showToast } from '../components/Toast';
// FIX: Renamed imported type EPRFForm to EPRFFormType to avoid conflict with the EPRFForm component.
import type { EPRFForm as EPRFFormType } from '../types';

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
    const hasRunEffect = useRef(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user || hasRunEffect.current) {
            return;
        }

        // If drafts are already in context (e.g., from navigating back), don't re-fetch.
        if (openEPRFDrafts.length > 0) {
            setIsLoading(false);
            return;
        }

        hasRunEffect.current = true;
        let isMounted = true;
        
        const loadOrCreateDrafts = async () => {
            setIsLoading(true);
            let drafts: EPRFFormType[] = [];
            try {
                drafts = await getAllDraftsForUser(user.uid);
            } catch (err) {
                console.error("Failed to load existing ePRF drafts. This may be due to a missing Firestore index. Proceeding as if none exist.", err);
                // We swallow this error and proceed as if no drafts were found.
            }
        
            if (!isMounted) return;
        
            if (drafts.length > 0) {
                drafts.forEach(addEPRFDraft);
                if (!activeEPRFId) {
                    setActiveEPRFId(drafts[0].id!);
                }
                setIsLoading(false);
            } else if (activeEvent) {
                try {
                    const newDraft = await createDraftEPRF(getInitialFormState(activeEvent, user));
                    if (!isMounted) return;
                    addEPRFDraft(newDraft);
                    setActiveEPRFId(newDraft.id!);
                } catch (createError) {
                    console.error("Failed to create new ePRF draft:", createError);
                    showToast("Failed to create a new ePRF draft.", "error");
                } finally {
                    if (isMounted) setIsLoading(false);
                }
            } else {
                // No drafts found, and no active event to create one for.
                if (isMounted) setIsLoading(false);
            }
        };

        loadOrCreateDrafts();
        
        return () => { isMounted = false; };
    }, [user, activeEvent]);

    const handleCloseForm = (formId: string) => {
        const draftIndex = openEPRFDrafts.findIndex(d => d.id === formId);
        removeEPRFDraft(formId);

        if (openEPRFDrafts.length <= 1) {
            setActiveEPRFId(null);
        } else {
            // Activate the previous tab, or the new first tab if the first was closed
            const nextIndex = Math.max(0, draftIndex - 1);
            setActiveEPRFId(openEPRFDrafts[nextIndex]?.id || null);
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
    
    if (activeDraft) {
        return <EPRFForm initialEPRFData={activeDraft} onComplete={() => handleCloseForm(activeDraft.id!)} />;
    }
    
    if (openEPRFDrafts.length > 0 && !activeDraft) {
        // Drafts exist but none is active. Set the first one.
        setActiveEPRFId(openEPRFDrafts[0].id!);
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <SpinnerIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading draft...</p>
            </div>
        );
    }
    
    if (openEPRFDrafts.length === 0 && !activeEvent) {
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

    // Default case: Loading drafts or creating a new one.
    return (
         <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <SpinnerIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Preparing ePRF...</p>
        </div>
    );
};