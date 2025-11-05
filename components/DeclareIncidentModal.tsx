import React, { useState } from 'react';
import type { User } from '../types';
import { declareMajorIncident } from '../services/majorIncidentService';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface DeclareIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (incidentId: string) => void;
    declarer: User;
}

const DeclareIncidentModal: React.FC<DeclareIncidentModalProps> = ({ isOpen, onClose, onSave, declarer }) => {
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        initialDetails: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const declarerInfo = { uid: declarer.uid, name: `${declarer.firstName} ${declarer.lastName}`.trim() };
            const incidentId = await declareMajorIncident(formData, declarerInfo);
            showToast("Major Incident declared. All staff have been notified.", "success");
            onSave(incidentId);
        } catch (error) {
            console.error("Failed to declare incident:", error);
            showToast("Failed to declare incident.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center modal-overlay" 
            onClick={onClose}
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-red-600 mb-6">Declare Major Incident</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Incident Name / Type</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClasses} placeholder="e.g., RTA M25 J10"/>
                        </div>
                        <div>
                            <label className={labelClasses}>Location</label>
                            <input type="text" name="location" value={formData.location} onChange={handleChange} required className={inputClasses} placeholder="e.g., Westbound carriageway"/>
                        </div>
                        <div>
                            <label className={labelClasses}>Initial Details</label>
                            <textarea name="initialDetails" value={formData.initialDetails} onChange={handleChange} rows={4} required className={inputClasses} placeholder="Provide a brief summary of the situation."/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Declare & Notify All Staff
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeclareIncidentModal;