import React, { useMemo } from 'react';
import type { KitCheck } from '../types';

interface KitCheckViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    check: KitCheck;
}

const getExpiryColor = (expiryDate?: string): string => {
    if (!expiryDate) return 'text-gray-500 dark:text-gray-400';
    const today = new Date();
    const expiry = new Date(expiryDate);
    today.setHours(0,0,0,0);
    expiry.setHours(0,0,0,0);
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    if (expiry < today) return 'text-red-500 font-bold';
    if (expiry <= thirtyDaysFromNow) return 'text-orange-500 font-semibold';
    return 'text-green-600 dark:text-green-400';
};


const KitCheckViewModal: React.FC<KitCheckViewModalProps> = ({ isOpen, onClose, check }) => {
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
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-2 flex-shrink-0">Kit Check Details</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex-shrink-0">
                    <p>For: {check.kitName} on {check.date.toDate().toLocaleString()}</p>
                    <p>By: {check.user.name} ({check.type})</p>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md mb-6">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Overall Status</p>
                        <p className={`font-bold ${check.overallStatus === 'Pass' ? 'text-green-600' : 'text-yellow-600'}`}>{check.overallStatus}</p>
                    </div>
                    
                    {check.itemsUsed && check.itemsUsed.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-2">Items Used/Restocked</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                {check.itemsUsed.map(item => <li key={item.itemName}>{item.itemName} (x{item.quantity})</li>)}
                            </ul>
                        </div>
                    )}
                    
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-2">Checked Items</h3>
                        <ul className="space-y-2">
                            {check.checkedItems.map(item => (
                                <li key={item.itemName} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{item.itemName}</span>
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusChip(item.status || 'N/A')}`}>
                                            {item.status || 'N/A'}
                                        </span>
                                    </div>
                                    {(item.status === 'Fail' && item.note) && (
                                        <p className="mt-1 pl-2 border-l-2 border-red-500 text-sm text-red-600 dark:text-red-400 italic">Note: {item.note}</p>
                                    )}
                                    {(item.expiryDate || item.batchNumber) && (
                                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex gap-4">
                                            <p><span className={getExpiryColor(item.expiryDate)}>Expiry: {item.expiryDate || 'N/A'}</span></p>
                                            <p>Batch: {item.batchNumber || 'N/A'}</p>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
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

export default KitCheckViewModal;
