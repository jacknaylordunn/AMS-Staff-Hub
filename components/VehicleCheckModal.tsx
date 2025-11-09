import React, { useState, Fragment } from 'react';
import type { Vehicle, VehicleCheck, User } from '../types';
import { VEHICLE_CHECKLIST_ITEMS } from '../types';
import { SpinnerIcon, ChevronRightIcon } from './icons';
import { showToast } from './Toast';

interface VehicleCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (check: Omit<VehicleCheck, 'id' | 'date'>) => Promise<void>;
    vehicle: Vehicle;
    user: User;
}

type ChecklistState = { [key: string]: { status: 'Pass' | 'Fail' | 'N/A'; note: string } };

const VehicleCheckModal: React.FC<VehicleCheckModalProps> = ({ isOpen, onClose, onSave, vehicle, user }) => {
    const [mileage, setMileage] = useState('');
    const [fuelLevel, setFuelLevel] = useState<'Full' | '3/4' | '1/2' | '1/4' | 'Empty'>('Full');
    const [notes, setNotes] = useState('');
    const [checklist, setChecklist] = useState<ChecklistState>(() => {
        const initialState: ChecklistState = {};
        Object.values(VEHICLE_CHECKLIST_ITEMS).flat().forEach(item => {
            initialState[item] = { status: 'Pass', note: '' };
        });
        return initialState;
    });
    const [loading, setLoading] = useState(false);
    
    const handleChecklistChange = (item: string, field: 'status' | 'note', value: string) => {
        setChecklist(prev => ({ ...prev, [item]: { ...prev[item], [field]: value } }));
    };

    const handlePassAll = (category: string) => {
        const itemsInCategory = VEHICLE_CHECKLIST_ITEMS[category as keyof typeof VEHICLE_CHECKLIST_ITEMS];
        const newChecklist = { ...checklist };
        itemsInCategory.forEach(item => {
            newChecklist[item] = { ...newChecklist[item], status: 'Pass' };
        });
        setChecklist(newChecklist);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mileage) {
            showToast("Please enter the current mileage.", "error");
            return;
        }

        setLoading(true);

        const checklistForSave: VehicleCheck['checklist'] = {};
        let aggregatedNotes = notes ? `Overall Notes: ${notes}\n\n` : '';
        let hasFailures = false;

        // FIX: Replaced Object.entries with Object.keys to fix type inference issue where `data` was `unknown`.
        Object.keys(checklist).forEach((item) => {
            const data = checklist[item];
            checklistForSave[item] = { status: data.status, note: data.note };
            if (data.status === 'Fail') {
                hasFailures = true;
                if (data.note) {
                    aggregatedNotes += `FAIL - ${item}: ${data.note}\n`;
                }
            }
        });

        const overallStatus = hasFailures ? 'Issues Found' : 'Pass';
        const userFullName = `${user.firstName} ${user.lastName}`.trim();
        
        const checkData: Omit<VehicleCheck, 'id' | 'date'> = {
            vehicleId: vehicle.id!,
            vehicleName: vehicle.name,
            user: { uid: user.uid, name: userFullName },
            mileage: Number(mileage),
            fuelLevel,
            checklist: checklistForSave,
            notes: aggregatedNotes.trim(),
            overallStatus,
        };
        await onSave(checkData);
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
            aria-labelledby="vehicle-check-modal-title"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-4xl max-h-[90vh] flex flex-col modal-content" onClick={e => e.stopPropagation()}>
                <h2 id="vehicle-check-modal-title" className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6 flex-shrink-0">Daily Check for {vehicle.name}</h2>
                <form id="vehicle-check-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 -mr-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className={labelClasses}>Current Mileage</label>
                            <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} required className={inputClasses} />
                        </div>
                        <div>
                             <label className={labelClasses}>Fuel Level</label>
                            <select value={fuelLevel} onChange={e => setFuelLevel(e.target.value as any)} className={inputClasses}>
                                <option>Full</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Empty</option>
                            </select>
                        </div>
                     </div>
                     
                     <div className="space-y-4">
                        {Object.entries(VEHICLE_CHECKLIST_ITEMS).map(([category, items]) => (
                            <details key={category} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 group" open>
                                <summary className="flex justify-between items-center cursor-pointer">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300">{category}</h3>
                                    <div className="flex items-center gap-4">
                                        <button type="button" onClick={(e) => { e.preventDefault(); handlePassAll(category); }} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200">Pass All</button>
                                        <ChevronRightIcon className="w-5 h-5 transition-transform group-open:rotate-90" />
                                    </div>
                                </summary>
                                <div className="mt-4 space-y-3">
                                    {items.map(item => (
                                        <div key={item} className="border-t dark:border-gray-600 pt-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                <label className="text-gray-700 dark:text-gray-300 font-medium">{item}</label>
                                                <div className="flex justify-start gap-1 p-1 bg-gray-200 dark:bg-gray-900 rounded-lg">
                                                    {['Pass', 'Fail', 'N/A'].map(status => (
                                                        <button type="button" key={status} onClick={() => handleChecklistChange(item, 'status', status)}
                                                        className={`w-full text-center px-3 py-1 text-sm rounded-md transition-colors ${checklist[item].status === status 
                                                            ? (status === 'Pass' ? 'bg-green-500 text-white' : status === 'Fail' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white')
                                                            : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{status}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            {checklist[item].status === 'Fail' && (
                                                <div className="mt-2 pl-4">
                                                    <input type="text" placeholder="Add a note for this fault..." value={checklist[item].note} onChange={(e) => handleChecklistChange(item, 'note', e.target.value)} className={`${inputClasses} text-sm`} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        ))}
                     </div>

                     <div className="mt-6">
                        <label className={labelClasses}>Overall Notes</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClasses}/>
                     </div>
                </form>
                <div className="flex justify-end gap-4 mt-8 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                    <button type="submit" form="vehicle-check-form" disabled={loading} className="px-6 py-2 bg-ams-blue text-white font-semibold rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                        {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                        Submit Check
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VehicleCheckModal;