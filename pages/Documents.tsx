import React, { useState, useMemo, useEffect } from 'react';
import type { CompanyDocument } from '../types';
import { getDocuments, createDocument, deleteDocument } from '../services/documentService';
import { SpinnerIcon, PlusIcon, TrashIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import DocumentUploadModal from '../components/DocumentUploadModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { showToast } from '../components/Toast';

const Documents: React.FC = () => {
    const { isManager } = useAuth();
    const { isOnline } = useOnlineStatus();
    const [documents, setDocuments] = useState<CompanyDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'SOP' | 'Guideline' | 'Procedure'>('all');
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<CompanyDocument | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const docs = await getDocuments();
            setDocuments(docs);
        } catch (error) {
            if (isOnline) {
                showToast("Failed to fetch documents.", "error");
                console.error("Failed to fetch documents:", error);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
    }, [isOnline]);

    const filteredDocuments = useMemo(() => {
        return documents
            .filter(doc => filter === 'all' || doc.category === filter)
            .filter(doc => doc.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, filter, documents]);

    const handleSaveDocument = async (docData: Omit<CompanyDocument, 'id'>) => {
        try {
            await createDocument(docData);
            showToast("Document uploaded successfully.", "success");
            fetchDocs(); // Refresh list
        } catch(e) {
            showToast("Failed to upload document.", "error");
        } finally {
            setUploadModalOpen(false);
        }
    };

    const openDeleteModal = (doc: CompanyDocument) => {
        setDocToDelete(doc);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!docToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDocument(docToDelete.id);
            showToast("Document deleted successfully.", "success");
            setDocuments(prev => prev.filter(d => d.id !== docToDelete.id));
        } catch (error) {
            showToast("Failed to delete document.", "error");
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
            setDocToDelete(null);
        }
    }

    const getCategoryColor = (category: CompanyDocument['category']) => {
        switch (category) {
            case 'SOP': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'Guideline': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Procedure': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        }
    }
    
    const inputClasses = "px-4 py-2 border rounded-md focus:ring-ams-light-blue focus:border-ams-light-blue dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";

    return (
        <div>
            {isManager && <DocumentUploadModal isOpen={isUploadModalOpen} onClose={() => setUploadModalOpen(false)} onSave={handleSaveDocument} />}
            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Document"
                message={`Are you sure you want to delete "${docToDelete?.title}"? This action cannot be undone.`}
                confirmText="Delete"
                isLoading={isDeleting}
            />

            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Documents Library</h1>
                 {isManager && (
                    <button 
                        onClick={() => setUploadModalOpen(true)} 
                        disabled={!isOnline}
                        className="flex items-center px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400">
                        <PlusIcon className="w-5 h-5 mr-2" /> Upload New Document
                    </button>
                )}
            </div>
            
            {!isOnline && (
                <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md dark:bg-yellow-900 dark:text-yellow-200">
                    <p><span className="font-bold">Offline Mode:</span> You are viewing cached documents. Please reconnect to upload or delete documents.</p>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={`w-full md:w-1/2 ${inputClasses}`}
                />
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value as any)}
                    className={`w-full md:w-auto bg-white ${inputClasses}`}
                >
                    <option value="all">All Categories</option>
                    <option value="SOP">SOPs</option>
                    <option value="Guideline">Guidelines</option>
                    <option value="Procedure">Procedures</option>
                </select>
            </div>
            
            {loading ? (
                 <div className="flex justify-center items-center p-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
                    <span className="ml-3 text-gray-600 dark:text-gray-300">Loading Documents...</span>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredDocuments.map(doc => (
                            <li key={doc.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700">
                               <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-grow">
                                        <div className="flex items-center justify-between">
                                            <p className="text-md font-medium text-ams-blue dark:text-ams-light-blue truncate">{doc.title}</p>
                                            <div className="ml-2 flex-shrink-0 flex">
                                                <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(doc.category)}`}>
                                                    {doc.category}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 sm:flex sm:justify-between">
                                            <div className="sm:flex">
                                                <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                                    Version: {doc.version}
                                                </p>
                                            </div>
                                        </div>
                                    </a>
                                     {isManager && (
                                        <button 
                                            onClick={() => openDeleteModal(doc)} 
                                            disabled={!isOnline}
                                            className="ml-4 p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                            title="Delete document"
                                        >
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    )}
                               </div>
                            </li>
                        ))}
                    </ul>
                    {filteredDocuments.length === 0 && (
                        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                            No documents found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Documents;
