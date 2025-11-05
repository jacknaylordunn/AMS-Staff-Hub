import React, { useState } from 'react';
import type { CompanyDocument } from '../types';
import { SpinnerIcon } from './icons';
import { uploadFile } from '../services/storageService';
import { showToast } from './Toast';

interface DocumentUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (document: Omit<CompanyDocument, 'id'>) => Promise<void>;
}

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: '',
        category: 'SOP' as CompanyDocument['category'],
        version: '',
    });
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            showToast("Please select a file to upload.", "error");
            return;
        }

        setLoading(true);
        try {
            const filePath = `documents/${Date.now()}_${file.name}`;
            const downloadURL = await uploadFile(file, filePath);
            await onSave({ ...formData, url: downloadURL });
            setFile(null);
            setFormData({ title: '', category: 'SOP', version: '' });
        } catch (error) {
            console.error("File upload failed:", error);
            showToast("File upload failed. Please try again.", "error");
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-upload-modal-title"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 id="doc-upload-modal-title" className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">Upload New Document</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Document Title</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>Category</label>
                             <select name="category" value={formData.category} onChange={handleChange} className={inputClasses}>
                                <option>SOP</option>
                                <option>Guideline</option>
                                <option>Procedure</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Version</label>
                            <input type="text" name="version" value={formData.version} onChange={handleChange} required className={inputClasses} placeholder="e.g., 1.0"/>
                        </div>
                        <div>
                            <label className={labelClasses}>File</label>
                            <input type="file" required onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt" className={`${inputClasses} p-1.5 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-ams-light-blue/10 file:text-ams-light-blue hover:file:bg-ams-light-blue/20 dark:file:bg-ams-light-blue/20 dark:file:text-ams-light-blue dark:hover:file:bg-ams-light-blue/30`}/>
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

export default DocumentUploadModal;