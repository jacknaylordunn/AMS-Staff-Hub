

import React, { useState } from 'react';
import type { User, ComplianceDocument } from '../types';
import { addComplianceDocumentToUser } from '../services/userService';
import { uploadFile } from '../services/storageService';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';
import firebase from 'firebase/compat/app';

interface ComplianceUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadComplete: () => void;
    userId: string;
}

const ComplianceUploadModal: React.FC<ComplianceUploadModalProps> = ({ isOpen, onClose, onUploadComplete, userId }) => {
    const [name, setName] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !name) {
            showToast("Document name and file are required.", "error");
            return;
        }

        setLoading(true);
        try {
            const filePath = `compliance_documents/${userId}/${Date.now()}_${file.name}`;
            const downloadURL = await uploadFile(file, filePath);
            
            const newDocument: ComplianceDocument = {
                id: Date.now().toString(),
                name,
                url: downloadURL,
                fileName: file.name,
                expiryDate: expiryDate || undefined,
                uploadedAt: firebase.firestore.Timestamp.now(),
            };

            await addComplianceDocumentToUser(userId, newDocument);
            
            showToast("Document uploaded successfully.", "success");
            onUploadComplete();
            setName('');
            setExpiryDate('');
            setFile(null);
        } catch (error) {
            console.error("File upload failed:", error);
            showToast("File upload failed. Please try again.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center modal-overlay" 
            onClick={onClose}
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">Add Compliance Document</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Document Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} placeholder="e.g., FREC 3 Certificate, DBS Certificate"/>
                        </div>
                        <div>
                            <label className={labelClasses}>Expiry Date (Optional)</label>
                            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>File</label>
                            <input type="file" required onChange={handleFileChange} className={`${inputClasses} p-1.5 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold`}/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Upload
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ComplianceUploadModal;