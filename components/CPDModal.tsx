import React, { useState, useEffect } from 'react';
import type { CPDEntry, User } from '../types';
import { addCPDEntry, updateCPDEntry } from '../services/cpdService';
import { uploadFile } from '../services/storageService';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface CPDModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    entry: CPDEntry | null;
    user: User;
}

const CPDModal: React.FC<CPDModalProps> = ({ isOpen, onClose, onSave, entry, user }) => {
    const [formData, setFormData] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        category: 'Formal Learning' as CPDEntry['category'],
        hours: '',
        learnings: '',
        reflection: '',
    });
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (entry) {
            setFormData({
                title: entry.title,
                date: entry.date,
                category: entry.category,
                hours: String(entry.hours),
                learnings: entry.learnings,
                reflection: entry.reflection,
            });
        } else {
            setFormData({
                title: '',
                date: new Date().toISOString().split('T')[0],
                category: 'Formal Learning',
                hours: '',
                learnings: '',
                reflection: '',
            });
        }
        setFile(null); // Reset file input on open
    }, [entry, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let attachmentUrl: string | undefined = entry?.attachmentUrl;
            let attachmentFileName: string | undefined = entry?.attachmentFileName;

            if (file) {
                const filePath = `cpd_attachments/${user.uid}/${Date.now()}_${file.name}`;
                attachmentUrl = await uploadFile(file, filePath);
                attachmentFileName = file.name;
            }

            const hoursAsNumber = parseFloat(formData.hours);
            if (isNaN(hoursAsNumber) || hoursAsNumber <= 0) {
                showToast("Please enter a valid number of hours.", "error");
                setLoading(false);
                return;
            }

            const entryData = {
                ...formData,
                hours: hoursAsNumber,
                userId: user.uid,
                attachmentUrl,
                attachmentFileName,
            };

            if (entry) {
                await updateCPDEntry(entry.id!, entryData);
                showToast("CPD entry updated.", "success");
            } else {
                await addCPDEntry(entryData);
                showToast("CPD entry added.", "success");
            }
            onSave();
        } catch (error) {
            console.error("Failed to save CPD entry:", error);
            showToast("Failed to save entry.", "error");
        } finally {
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
            aria-labelledby="cpd-modal-title"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 id="cpd-modal-title" className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">{entry ? 'Edit CPD Entry' : 'Add CPD Entry'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Title of Activity</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} required className={inputClasses} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClasses}>Date</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Category</label>
                                <select name="category" value={formData.category} onChange={handleChange} className={inputClasses}>
                                    <option>Formal Learning</option>
                                    <option>Work-based Learning</option>
                                    <option>Self-directed Learning</option>
                                    <option>Other</option>
                                </select>
                            </div>
                             <div>
                                <label className={labelClasses}>Hours</label>
                                <input type="number" name="hours" value={formData.hours} onChange={handleChange} required className={inputClasses} min="0.5" step="0.5" />
                            </div>
                        </div>
                         <div>
                            <label className={labelClasses}>Key Learnings</label>
                            <textarea name="learnings" value={formData.learnings} onChange={handleChange} required rows={4} className={inputClasses} />
                        </div>
                         <div>
                            <label className={labelClasses}>Reflection</label>
                            <textarea name="reflection" value={formData.reflection} onChange={handleChange} required rows={4} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Upload Certificate (Optional)</label>
                            {entry?.attachmentUrl && !file && <p className="text-sm text-gray-500">Current file: <a href={entry.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-ams-light-blue hover:underline">{entry.attachmentFileName}</a></p>}
                            <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className={`${inputClasses} p-1.5 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-ams-light-blue/10 file:text-ams-light-blue hover:file:bg-ams-light-blue/20 dark:file:bg-ams-light-blue/20 dark:file:text-ams-light-blue dark:hover:file:bg-ams-light-blue/30`}/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Save Entry
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CPDModal;
