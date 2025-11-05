import React, { useState } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { useAuth } from '../hooks/useAuth';
import { createDraftEPRF, deleteEPRF } from '../services/eprfService';
import { getInitialFormState } from '../utils/eprfHelpers';
import { PlusIcon } from './icons';
import ConfirmationModal from './ConfirmationModal';
import { showToast } from './Toast';

const EPRFTabs: React.FC = () => {
    const { 
        openEPRFDrafts, 
        activeEPRFId, 
        setActiveEPRFId, 
        addEPRFDraft, 
        removeEPRFDraft,
        activeEvent
    } = useAppContext();
    const { user } = useAuth();
    const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

    const handleNewDraft = async () => {
        if (!user || !activeEvent) {
            showToast("You must be logged into an event to create an ePRF.", "error");
            return;
        }
        try {
            const newDraft = await createDraftEPRF(getInitialFormState(activeEvent, user));
            addEPRFDraft(newDraft);
            setActiveEPRFId(newDraft.id!);
        } catch (error) {
            showToast("Failed to create new draft.", "error");
        }
    };

    const handleCloseDraft = async () => {
        if (!draftToDelete) return;

        if (openEPRFDrafts.length <= 1) {
            showToast("You cannot close the last open ePRF.", "info");
            setDraftToDelete(null);
            return;
        }
        
        try {
            await deleteEPRF(draftToDelete);
            
            if (activeEPRFId === draftToDelete) {
                const draftIndex = openEPRFDrafts.findIndex(d => d.id === draftToDelete);
                const nextDraft = openEPRFDrafts[draftIndex - 1] || openEPRFDrafts[draftIndex + 1];
                setActiveEPRFId(nextDraft.id!);
            }
            removeEPRFDraft(draftToDelete);
            showToast("Draft closed.", "success");
        } catch (error) {
            showToast("Failed to close draft.", "error");
        } finally {
            setDraftToDelete(null);
        }
    };

    return (
        <>
            <ConfirmationModal 
                isOpen={!!draftToDelete}
                onClose={() => setDraftToDelete(null)}
                onConfirm={handleCloseDraft}
                title="Close ePRF Draft"
                message="Are you sure you want to close and discard this draft? This action cannot be undone."
                confirmText="Close & Discard"
            />
            <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 sm:px-4">
                <div className="flex -mb-px space-x-1 overflow-x-auto">
                    {openEPRFDrafts.map((draft, index) => (
                        <div key={draft.id} className="relative group flex-shrink-0">
                             <button
                                onClick={() => setActiveEPRFId(draft.id!)}
                                className={`flex items-center whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${
                                    activeEPRFId === draft.id
                                    ? 'border-ams-light-blue text-ams-blue dark:text-ams-light-blue'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                            >
                                {draft.patientName || `Patient ${index + 1}`}
                            </button>
                             <button 
                                onClick={() => setDraftToDelete(draft.id!)}
                                className="absolute top-1 right-0 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100"
                                title="Close this draft"
                            >
                                <span className="text-xs font-bold leading-none">✖</span>
                            </button>
                        </div>
                    ))}
                </div>
                 <button onClick={handleNewDraft} title="Create New ePRF" className="p-2 ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>
        </>
    );
};

export default EPRFTabs;
