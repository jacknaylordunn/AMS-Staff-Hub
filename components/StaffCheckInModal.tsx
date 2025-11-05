import React, { useState } from 'react';
import type { MajorIncident, User, StaffCheckin } from '../types';
import { checkInToIncident } from '../services/majorIncidentService';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface StaffCheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    incident: MajorIncident;
    user: User;
}

const StaffCheckInModal: React.FC<StaffCheckInModalProps> = ({ isOpen, onClose, incident, user }) => {
    const [status, setStatus] = useState<StaffCheckin['status']>('Available - On Site');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await checkInToIncident(incident.id!, user, status);
            showToast("Your status has been updated.", "success");
            onClose();
        } catch (error) {
            showToast("Failed to update status.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;
    
    const statuses: StaffCheckin['status'][] = ['Available - On Site', 'Available - En Route', 'Unavailable'];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-2">Major Incident Check-In</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Please update your current status for the incident: <strong>{incident.name}</strong></p>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-3">
                        {statuses.map(s => (
                             <label key={s} className="flex items-center p-4 border rounded-lg cursor-pointer has-[:checked]:bg-ams-blue/10 has-[:checked]:border-ams-blue dark:border-gray-600">
                                <input 
                                    type="radio" 
                                    name="status" 
                                    value={s} 
                                    checked={status === s} 
                                    onChange={() => setStatus(s)}
                                    className="h-5 w-5 text-ams-blue focus:ring-ams-light-blue"
                                />
                                <span className="ml-3 font-medium text-gray-800 dark:text-gray-200">{s}</span>
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />} Update Status
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StaffCheckInModal;