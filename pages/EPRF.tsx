import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAllDraftsForUser, createDraftEPRF } from '../services/eprfService';
import { getInitialFormState } from '../utils/eprfHelpers';
import EPRFForm from '../components/EPRFForm';
import { SpinnerIcon, PlusIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import type { EPRFForm as EPRFFormType } from '../types';

export const EPRF: React.FC = () => {
    const { user } = useAuth();
    const [activeDraft, setActiveDraft] = useState<EPRFFormType | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadDraft = async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const drafts = await getAllDraftsForUser(user.uid);
            if (drafts.length > 0) {
                if (drafts.length > 1) {
                    console.warn("Multiple drafts found, loading the most recent one. The new workflow supports one draft at a time.");
                }
                setActiveDraft(drafts[0]);
            } else {
                setActiveDraft(null);
            }
        } catch (error) {
            showToast("Failed to check for existing ePRF drafts.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDraft();
    }, [user]);

    const handleCreateNewDraft = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // The initial state function can take a null event, which is what we want.
            const newDraft = await createDraftEPRF(getInitialFormState(null, user));
            setActiveDraft(newDraft);
        } catch (error) {
            showToast("Failed to create new ePRF.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompleteOrDelete = () => {
        // This function will be passed to the EPRFForm component
        // to call when it's done, which brings us back to the landing page.
        setActiveDraft(null);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <SpinnerIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">Checking for an existing draft...</p>
            </div>
        );
    }
    
    if (activeDraft) {
        return <EPRFForm initialEPRFData={activeDraft} onComplete={handleCompleteOrDelete} />;
    }

    return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Patient Report Form</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Create a new electronic Patient Report Form.</p>
            <button
                onClick={handleCreateNewDraft}
                className="mt-8 flex items-center justify-center px-8 py-4 bg-ams-blue text-white font-bold rounded-lg shadow-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
            >
                <PlusIcon className="w-6 h-6 mr-3" />
                Start New ePRF
            </button>
        </div>
    );
};

export default EPRF;