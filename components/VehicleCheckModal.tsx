import React, { useState } from 'react';
import type { Vehicle, VehicleCheck, User } from '../types';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface VehicleCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (check: Omit<VehicleCheck, 'id' | 'date'>) => Promise<void>;
    vehicle: Vehicle;
    user: User;
}

const CHECKLIST_ITEMS = {
    'Exterior': ['Bodywork & Livery', 'Tyres & Wheels', 'Lights & Sirens'],
    'Interior': ['Dash Warnings', 'Cleanliness', 'Fire Extinguisher'],
    'Clinical': ['Defibrillator', 'Oxygen Levels', 'Suction Unit', 'Resus Kit'],
};

type ChecklistState = { [key: string]: 'Pass' | 'Fail' | 'N/A' };

const VehicleCheckModal: React.FC<VehicleCheckModalProps> = ({ isOpen, onClose, onSave, vehicle, user }) => {
    const [mileage, setMileage] = useState('');
    const [fuelLevel, setFuelLevel] = useState<'Full' | '3/4' | '1/2' | '1/4' | 'Empty'>('Full');
    const [notes, setNotes] = useState('');
    const [checklist, setChecklist] = useState<ChecklistState>(() => {
        const initialState: ChecklistState = {};
        Object.values(CHECKLIST_ITEMS).flat().forEach(item => {
            initialState[item] = 'Pass';
        });
        return initialState;
    });
    const [loading, setLoading] = useState(false);
    
    const handleChecklistChange = (item: string, status: 'Pass' | 'Fail' | 'N/A') => {
        setChecklist(prev => ({ ...prev, [item]: status }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mileage) {
            showToast("Please enter the current mileage.", "error");
            return;
        }

        setLoading(true);
        const overallStatus = Object.values(checklist).some(status => status === 'Fail') ? 'Issues Found' : 'Pass';
        const userFullName = `${user.firstName} ${user.lastName}`.trim();
        
        const checkData: Omit<VehicleCheck, 'id' | 'date'> = {
            vehicleId: vehicle.id!,
            vehicleName: vehicle.name,
            user: { uid: user.uid, name: userFullName },
            mileage: Number(mileage),
            fuelLevel,
            checklist,
            notes,
            overallStatus,
        };
        await onSave(checkData);
        setLoading(false);
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">Daily Check for {vehicle.name}</h2>
                <form onSubmit={handleSubmit}>
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
                     
                     <div className="space-y-6">
                        {Object.entries(CHECKLIST_ITEMS).map(([category, items]) => (
                            <div key={category}>
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-3">{category}</h3>
                                <div className="space-y-2">
                                    {items.map(item => (
                                        <div key={item} className="grid grid-cols-3 gap-2 items-center">
                                            <label className="text-gray-700 dark:text-gray-300">{item}</label>
                                            <div className="col-span-2 flex justify-start gap-2">
                                                {['Pass', 'Fail', 'N/A'].map(status => (
                                                    <button type="button" key={status} onClick={() => handleChecklistChange(item, status as any)}
                                                    className={`px-3 py-1 text-sm rounded-full ${checklist[item] === status 
                                                        ? (status === 'Pass' ? 'bg-green-500 text-white' : status === 'Fail' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white')
                                                        : 'bg-gray-200 dark:bg-gray-600'}`}>{status}</button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                     </div>

                     <div className="mt-6">
                        <label className={labelClasses}>Notes (document any faults or issues)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className={inputClasses}/>
                     </div>
                    
                    <div className="flex justify-end gap-4 mt-8">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-ams-blue text-white font-semibold rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Submit Check
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VehicleCheckModal;