
import React, { useState, useEffect } from 'react';
import type { Kit } from '../types';
import { SpinnerIcon } from './icons';

interface KitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (kit: Omit<Kit, 'id' | 'createdAt' | 'lastCheck' | 'assignedTo' | 'qrCodeValue'>) => Promise<void>;
    kit: Kit | null;
}

const KitModal: React.FC<KitModalProps> = ({ isOpen, onClose, onSave, kit }) => {
    const [formData, setFormData] = useState({
        name: '',
        type: 'Response Bag' as Kit['type'],
        status: 'In Service' as Kit['status'],
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (kit) {
            setFormData({
                name: kit.name,
                type: kit.type,
                status: kit.status,
            });
        } else {
            setFormData({
                name: '',
                type: 'Response Bag',
                status: 'In Service',
            });
        }
    }, [kit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onSave(formData);
        setLoading(false);
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
            aria-labelledby="kit-modal-title"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 id="kit-modal-title" className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">{kit ? 'Edit Kit' : 'Add New Kit'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Kit Name / Identifier</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClasses} placeholder="e.g., Response Bag 1"/>
                        </div>
                        <div>
                            <label className={labelClasses}>Type</label>
                             <select name="type" value={formData.type} onChange={handleChange} className={inputClasses}>
                                <option>Response Bag</option>
                                <option>Trauma Bag</option>
                                <option>Drug Kit</option>
                                <option>O2 Bag</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className={inputClasses}>
                                <option>In Service</option>
                                <option>Needs Restocking</option>
                                <option>Out of Service</option>
                                <option>With Crew</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Save Kit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default KitModal;
