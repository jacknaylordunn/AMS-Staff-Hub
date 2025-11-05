import React, { useState } from 'react';
import type { MajorIncident, User, METHANEreport } from '../types';
import { submitMethaneReport } from '../services/majorIncidentService';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface MethaneReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    incident: MajorIncident;
    user: User;
}

const MethaneReportModal: React.FC<MethaneReportModalProps> = ({ isOpen, onClose, incident, user }) => {
    const [formData, setFormData] = useState({
        majorIncident: 'Yes' as METHANEreport['majorIncident'],
        exactLocation: incident.location,
        typeOfIncident: '',
        hazards: '',
        access: '',
        numberOfCasualties: '',
        emergencyServices: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const reportData = {
                ...formData,
                incidentId: incident.id!,
                submittedBy: { uid: user.uid, name: `${user.firstName} ${user.lastName}`.trim() },
            };
            await submitMethaneReport(reportData);
            showToast("METHANE report submitted.", "success");
            onClose();
        } catch (error) {
            showToast("Failed to submit report.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">Submit METHANE Report</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-gray-500">M: Major Incident Declared?</p>
                    <select name="majorIncident" value={formData.majorIncident} onChange={handleChange} className={inputClasses}>
                        <option>Yes</option><option>No</option>
                    </select>
                    
                    <label className={labelClasses}>E: Exact Location</label>
                    <input type="text" name="exactLocation" value={formData.exactLocation} onChange={handleChange} required className={inputClasses} />

                    <label className={labelClasses}>T: Type of Incident</label>
                    <input type="text" name="typeOfIncident" value={formData.typeOfIncident} onChange={handleChange} required className={inputClasses} />
                    
                    <label className={labelClasses}>H: Hazards Present</label>
                    <input type="text" name="hazards" value={formData.hazards} onChange={handleChange} required className={inputClasses} />

                    <label className={labelClasses}>A: Access (Routes, etc.)</label>
                    <input type="text" name="access" value={formData.access} onChange={handleChange} required className={inputClasses} />

                    <label className={labelClasses}>N: Number & Type of Casualties</label>
                    <input type="text" name="numberOfCasualties" value={formData.numberOfCasualties} onChange={handleChange} required className={inputClasses} />

                    <label className={labelClasses}>E: Emergency Services Present</label>
                    <input type="text" name="emergencyServices" value={formData.emergencyServices} onChange={handleChange} required className={inputClasses} />

                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />} Submit Report
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MethaneReportModal;