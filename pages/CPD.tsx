import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getCPDEntriesForUser, deleteCPDEntry } from '../services/cpdService';
import type { CPDEntry } from '../types';
import { SpinnerIcon, PlusIcon, CPDIcon, PencilIcon, TrashIcon, DocsIcon } from '../components/icons';
import CPDModal from '../components/CPDModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { showToast } from '../components/Toast';

const CPD: React.FC = () => {
    const { user } = useAuth();
    const [entries, setEntries] = useState<CPDEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<CPDEntry | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchEntries = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const userEntries = await getCPDEntriesForUser(user.uid);
            setEntries(userEntries);
        } catch (error) {
            console.error("Failed to fetch CPD entries:", error);
            showToast("Could not load CPD entries.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, [user]);

    const handleOpenModal = (entry: CPDEntry | null) => {
        setSelectedEntry(entry);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedEntry(null);
    };

    const handleSave = () => {
        fetchEntries(); // Refresh list after save
        handleCloseModal();
    };

    const handleDeleteClick = (entry: CPDEntry) => {
        setSelectedEntry(entry);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedEntry) return;
        setIsDeleting(true);
        try {
            await deleteCPDEntry(selectedEntry.id!);
            showToast("CPD entry deleted.", "success");
            setEntries(prev => prev.filter(e => e.id !== selectedEntry.id));
        } catch (error) {
            showToast("Failed to delete entry.", "error");
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
            setSelectedEntry(null);
        }
    };
    
    const totalHours = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

    return (
        <div>
            {user && (
                <CPDModal 
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    entry={selectedEntry}
                    user={user}
                />
            )}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete CPD Entry"
                message={`Are you sure you want to delete "${selectedEntry?.title}"? This cannot be undone.`}
                confirmText="Delete"
                isLoading={isDeleting}
            />

            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">CPD Log</h1>
                <div className="flex items-center gap-4">
                     <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Hours Logged</p>
                        <p className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">{totalHours}</p>
                    </div>
                    <button 
                        onClick={() => handleOpenModal(null)} 
                        className="flex items-center px-4 py-2 bg-ams-blue text-white font-semibold rounded-md shadow hover:bg-opacity-90">
                        <PlusIcon className="w-5 h-5 mr-2" /> Add New Entry
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" /></div>
            ) : entries.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <CPDIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-200">No CPD Entries Yet</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Click "Add New Entry" to start logging your professional development.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {entries.map(entry => (
                        <div key={entry.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow transition-shadow hover:shadow-md">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                <div className="flex-grow">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{entry.date} - {entry.category}</p>
                                    <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue">{entry.title}</h3>
                                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Key Learnings:</span> {entry.learnings}</p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Reflection:</span> {entry.reflection}</p>
                                </div>
                                <div className="flex flex-col items-start sm:items-end flex-shrink-0">
                                    <div className="px-3 py-1 bg-ams-blue/10 text-ams-blue dark:bg-ams-light-blue/20 dark:text-ams-light-blue font-bold rounded-full mb-3">{entry.hours} Hours</div>
                                    <div className="flex items-center gap-2">
                                        {entry.attachmentUrl && (
                                            <a href={entry.attachmentUrl} target="_blank" rel="noopener noreferrer" title={entry.attachmentFileName} className="p-2 text-gray-500 hover:text-ams-light-blue dark:text-gray-400 dark:hover:text-ams-light-blue">
                                                <DocsIcon className="w-5 h-5" />
                                            </a>
                                        )}
                                        <button onClick={() => handleOpenModal(entry)} className="p-2 text-gray-500 hover:text-ams-blue dark:text-gray-400 dark:hover:text-ams-blue" title="Edit Entry">
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDeleteClick(entry)} className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-500" title="Delete Entry">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CPD;