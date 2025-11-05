import React, { useState, useEffect } from 'react';
import type { Kit, KitCheck, User } from '../types';
import { KIT_CHECKLIST_ITEMS } from '../types';
import { SpinnerIcon, PlusIcon, TrashIcon } from './icons';
import { showToast } from './Toast';

interface KitCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (check: Omit<KitCheck, 'id' | 'date'>) => Promise<void>;
    kit: Kit;
    user: User;
    type: 'Sign Out' | 'Sign In';
}

type CheckedItemState = {
    status: 'Pass' | 'Fail' | 'N/A';
    expiryDate?: string;
    batchNumber?: string;
};
type ItemsUsedState = { itemName: string, quantity: number }[];

const KitCheckModal: React.FC<KitCheckModalProps> = ({ isOpen, onClose, onSave, kit, user, type }) => {
    const [notes, setNotes] = useState('');
    const [checkedItems, setCheckedItems] = useState<{ [key: string]: CheckedItemState }>({});
    const [itemsUsed, setItemsUsed] = useState<ItemsUsedState>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const initialState: { [key: string]: CheckedItemState } = {};
        Object.values(KIT_CHECKLIST_ITEMS).flat().forEach(item => {
            const existingTrackedData = kit.trackedItems?.find(t => t.itemName === item.name);
            initialState[item.name] = {
                status: 'Pass',
                expiryDate: existingTrackedData?.expiryDate || '',
                batchNumber: existingTrackedData?.batchNumber || ''
            };
        });
        setCheckedItems(initialState);
        setItemsUsed([]);
        setNotes('');
    }, [isOpen, kit]);
    
    const handleItemChange = (itemName: string, field: keyof CheckedItemState, value: string) => {
        setCheckedItems(prev => ({
            ...prev,
            [itemName]: { ...prev[itemName], [field]: value }
        }));
    };

    const handleItemUsedChange = (index: number, field: 'itemName' | 'quantity', value: string) => {
        const newItems = [...itemsUsed];
        newItems[index] = { ...newItems[index], [field]: field === 'quantity' ? Number(value) : value };
        setItemsUsed(newItems);
    };
    const addItemUsed = () => setItemsUsed([...itemsUsed, { itemName: '', quantity: 1 }]);
    const removeItemUsed = (index: number) => setItemsUsed(itemsUsed.filter((_, i) => i !== index));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // FIX: Explicitly typed the `data` parameter in the map callback to resolve errors where properties did not exist on type `unknown`.
        const checkedItemsArray = Object.entries(checkedItems).map(([itemName, data]: [string, CheckedItemState]) => ({
            itemName,
            status: data.status || 'N/A',
            expiryDate: data.expiryDate,
            batchNumber: data.batchNumber,
        }));
        const overallStatus = checkedItemsArray.some(item => item.status === 'Fail') ? 'Issues Found' : 'Pass';
        const userFullName = `${user.firstName} ${user.lastName}`.trim();
        
        const checkData: Omit<KitCheck, 'id' | 'date'> = {
            kitId: kit.id!,
            kitName: kit.name,
            user: { uid: user.uid, name: userFullName },
            type,
            checkedItems: checkedItemsArray,
            itemsUsed: type === 'Sign In' ? itemsUsed.filter(i => i.itemName) : undefined,
            notes,
            overallStatus,
        };
        await onSave(checkData);
        setLoading(false);
    };

    if (!isOpen) return null;

    const inputClasses = "block w-full px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center modal-overlay" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-4xl max-h-[90vh] flex flex-col modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6 flex-shrink-0">{type} Check for {kit.name}</h2>
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2">
                     <div className="space-y-6">
                        {Object.entries(KIT_CHECKLIST_ITEMS).map(([category, items]) => (
                            <div key={category}>
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-3">{category}</h3>
                                <div className="space-y-3">
                                    {items.map(item => (
                                        <div key={item.name} className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 items-center">
                                            <label className="text-gray-700 dark:text-gray-300 font-medium">{item.name}</label>
                                            
                                            <div className="flex justify-start gap-2">
                                                {['Pass', 'Fail', 'N/A'].map(status => (
                                                    <button type="button" key={status} onClick={() => handleItemChange(item.name, 'status', status)}
                                                    className={`px-3 py-1 text-xs rounded-full ${checkedItems[item.name]?.status === status 
                                                        ? (status === 'Pass' ? 'bg-green-500 text-white' : status === 'Fail' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white')
                                                        : 'bg-gray-200 dark:bg-gray-600'}`}>{status}</button>
                                                ))}
                                            </div>

                                            {item.trackable && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-xs text-gray-500">Expiry</label>
                                                        <input type="date" value={checkedItems[item.name]?.expiryDate || ''} onChange={e => handleItemChange(item.name, 'expiryDate', e.target.value)} className={inputClasses} />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-500">Batch #</label>
                                                        <input type="text" value={checkedItems[item.name]?.batchNumber || ''} onChange={e => handleItemChange(item.name, 'batchNumber', e.target.value)} className={inputClasses} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                     </div>

                    {type === 'Sign In' && (
                        <div className="mt-6 pt-4 border-t dark:border-gray-600">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className={labelClasses}>Items Used</h3>
                                <button type="button" onClick={addItemUsed} className="flex items-center text-sm text-ams-blue dark:text-ams-light-blue"><PlusIcon className="w-4 h-4 mr-1"/>Add Item</button>
                            </div>
                            <div className="space-y-2">
                                {itemsUsed.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <input type="text" placeholder="Item Name" value={item.itemName} onChange={e => handleItemUsedChange(index, 'itemName', e.target.value)} className={`${inputClasses} flex-grow`} />
                                        <input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleItemUsedChange(index, 'quantity', e.target.value)} className={`${inputClasses} w-20`} min="1" />
                                        <button type="button" onClick={() => removeItemUsed(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                     <div className="mt-6">
                        <label className={labelClasses}>Notes (document any faults or issues)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClasses}/>
                     </div>
                </form>
                <div className="flex justify-end gap-4 mt-8 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                    <button type="submit" form="kit-check-form" onClick={handleSubmit} disabled={loading} className="px-6 py-2 bg-ams-blue text-white font-semibold rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                        {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                        Submit Check
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KitCheckModal;