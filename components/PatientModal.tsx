import React, { useState, FormEvent } from 'react';
import type { Patient } from '../types';
import { SpinnerIcon } from './icons';

interface PatientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (patient: Omit<Patient, 'id' | 'createdAt'>) => Promise<void>;
}

const PatientModal: React.FC<PatientModalProps> = ({ isOpen, onClose, onSave }) => {
    const [patient, setPatient] = useState<Omit<Patient, 'id' | 'createdAt'>>({
        firstName: '', lastName: '', dob: '', gender: 'Unknown', address: '',
        allergies: '', medications: '', medicalHistory: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setPatient({ ...patient, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onSave(patient);
        setLoading(false);
        setPatient({ firstName: '', lastName: '', dob: '', gender: 'Unknown', address: '', allergies: '', medications: '', medicalHistory: '' });
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">Create New Patient Record</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>First Name</label>
                            <input type="text" name="firstName" value={patient.firstName} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>Last Name</label>
                            <input type="text" name="lastName" value={patient.lastName} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>Date of Birth</label>
                            <input type="date" name="dob" value={patient.dob} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>Gender</label>
                            <select name="gender" value={patient.gender} onChange={handleChange} className={inputClasses}>
                                <option>Unknown</option><option>Male</option><option>Female</option><option>Other</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                             <label className={labelClasses}>Address</label>
                             <textarea name="address" value={patient.address} onChange={handleChange} rows={2} className={inputClasses}/>
                        </div>
                        <div className="md:col-span-2">
                             <label className={labelClasses}>Allergies</label>
                             <textarea name="allergies" value={patient.allergies} onChange={handleChange} rows={2} className={inputClasses}/>
                        </div>
                        <div className="md:col-span-2">
                             <label className={labelClasses}>Current Medications</label>
                             <textarea name="medications" value={patient.medications} onChange={handleChange} rows={2} className={inputClasses}/>
                        </div>
                        <div className="md:col-span-2">
                             <label className={labelClasses}>Past Medical History</label>
                             <textarea name="medicalHistory" value={patient.medicalHistory} onChange={handleChange} rows={3} className={inputClasses}/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Save Patient
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PatientModal;
