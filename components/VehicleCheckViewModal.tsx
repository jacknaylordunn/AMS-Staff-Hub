import React from 'react';
import type { VehicleCheck } from '../types';
import { VEHICLE_CHECKLIST_ITEMS } from '../types';

interface VehicleCheckViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    check: VehicleCheck;
}

const VehicleCheckViewModal: React.FC<VehicleCheckViewModalProps> = ({ isOpen, onClose, check }) => {
    if (!isOpen) return null;

    const getStatusChip = (status: 'Pass' | 'Fail' | 'N/A') => {
        switch(status) {
            case 'Pass': return 'bg-green-100 text-green-800';
            case 'Fail': return 'bg-red-100 text-red-800';
            case 'N/A': return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center modal-overlay" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-3xl max-h-[90vh] flex flex-col modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-2 flex-shrink-0">Vehicle Check Details</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex-shrink-0">
                    <p>For: {check.vehicleName} on {check.date.toDate().toLocaleString()}</p>
                    <p>By: {check.user.name}</p>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Overall Status</p>
                            <p className={`font-bold ${check.overallStatus === 'Pass' ? 'text-green-600' : 'text-yellow-600'}`}>{check.overallStatus}</p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Mileage</p>
                            <p className="font-semibold dark:text-gray-200">{check.mileage}</p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Fuel Level</p>
                            <p className="font-semibold dark:text-gray-200">{check.fuelLevel}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {Object.entries(VEHICLE_CHECKLIST_ITEMS).map(([category, items]) => (
                            <div key={category}>
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-2">{category}</h3>
                                <ul className="space-y-2">
                                    {items.map(item => {
                                        const checkItem = check.checklist[item];
                                        return (
                                            <li key={item} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">{item}</span>
                                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusChip(checkItem?.status || 'N/A')}`}>
                                                        {checkItem?.status || 'N/A'}
                                                    </span>
                                                </div>
                                                {checkItem?.status === 'Fail' && checkItem.note && (
                                                    <p className="mt-1 pl-2 border-l-2 border-red-500 text-sm text-red-600 dark:text-red-400 italic">Note: {checkItem.note}</p>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {check.notes && (
                         <div className="mt-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-2">Overall Notes</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{check.notes}</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end mt-6 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90">Close</button>
                </div>
            </div>
        </div>
    );
};

export default VehicleCheckViewModal;
