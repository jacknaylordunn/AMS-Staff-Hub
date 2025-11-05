import React, { useState, useEffect } from 'react';
import type { Vehicle } from '../types';
import { SpinnerIcon } from './icons';

interface VehicleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'lastCheck'>) => Promise<void>;
    vehicle: Vehicle | null;
}

const VehicleModal: React.FC<VehicleModalProps> = ({ isOpen, onClose, onSave, vehicle }) => {
    const [formData, setFormData] = useState({
        name: '',
        registration: '',
        type: 'Ambulance' as Vehicle['type'],
        status: 'In Service' as Vehicle['status'],
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (vehicle) {
            setFormData({
                name: vehicle.name,
                registration: vehicle.registration,
                type: vehicle.type,
                status: vehicle.status,
            });
        } else {
            setFormData({
                name: '',
                registration: '',
                type: 'Ambulance',
                status: 'In Service',
            });
        }
    }, [vehicle]);

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
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center modal-overlay" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-modal-title"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg modal-content" onClick={e => e.stopPropagation()}>
                <h2 id="vehicle-modal-title" className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">{vehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Vehicle Name / Call Sign</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClasses} placeholder="e.g., Ambulance 1"/>
                        </div>
                        <div>
                            <label className={labelClasses}>Registration</label>
                            <input type="text" name="registration" value={formData.registration} onChange={handleChange} required className={inputClasses} placeholder="e.g., AB12 CDE"/>
                        </div>
                        <div>
                            <label className={labelClasses}>Type</label>
                             <select name="type" value={formData.type} onChange={handleChange} className={inputClasses}>
                                <option>Ambulance</option>
                                <option>RRV</option>
                                <option>Car</option>
                                <option>Buggy</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className={inputClasses}>
                                <option>In Service</option>
                                <option>Maintenance Required</option>
                                <option>Out of Service</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Save Vehicle
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VehicleModal;