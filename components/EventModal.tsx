import React, { useState, useEffect } from 'react';
import type { EventLog } from '../types';
import { SpinnerIcon } from './icons';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<EventLog, 'id' | 'status'>) => Promise<void>;
    event: EventLog | null;
}

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, event }) => {
    const [formData, setFormData] = useState({
        name: '',
        date: '',
        location: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (event) {
            setFormData({
                name: event.name,
                date: event.date,
                location: event.location,
            });
        } else {
            setFormData({
                name: '',
                date: new Date().toISOString().split('T')[0],
                location: '',
            });
        }
    }, [event]);

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
            aria-labelledby="event-modal-title"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg modal-content" onClick={e => e.stopPropagation()}>
                <h2 id="event-modal-title" className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">{event ? 'Edit Event' : 'Create New Event'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Event Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>Location</label>
                            <input type="text" name="location" value={formData.location} onChange={handleChange} required className={inputClasses}/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Save Event
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventModal;