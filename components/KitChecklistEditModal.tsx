import React, { useState, useEffect } from 'react';
import type { Kit, KitChecklistItem } from '../types';
import { SpinnerIcon, PlusIcon, TrashIcon } from './icons';

interface KitChecklistEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (checklist: KitChecklistItem[]) => Promise<void>;
    kit: Kit;
}

const KitChecklistEditModal: React.FC<KitChecklistEditModalProps> = ({ isOpen, onClose, onSave, kit }) => {
    const [items, setItems] = useState<KitChecklistItem[]>([]);
    const [newItem, setNewItem] = useState({ name: '', category: '', trackable: false });
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (kit.checklistItems) {
            setItems([...kit.checklistItems]);
        }
    }, [kit, isOpen]);

    const itemsByCategory = items.reduce((acc, item) => {
        (acc[item.category] = acc[item.category] || []).push(item);
        return acc;
    }, {} as Record<string, KitChecklistItem[]>);
    
    const allCategories = [...new Set(items.map(i => i.category))];

    const handleAddItem = () => {
        if (!newItem.name.trim() || !newItem.category.trim()) {
            return; // Basic validation
        }
        setItems([...items, { ...newItem }]);
        setNewItem({ name: '', category: newItem.category, trackable: false }); // Keep category for next item
    };
    
    const handleRemoveItem = (itemToRemove: KitChecklistItem) => {
        setItems(items.filter(item => item.name !== itemToRemove.name || item.category !== itemToRemove.category));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onSave(items);
        setLoading(false);
    };

    if (!isOpen) return null;

    const inputClasses = "block w-full px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center modal-overlay" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-3xl max-h-[90vh] flex flex-col modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6 flex-shrink-0">Edit Checklist for {kit.name}</h2>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {Object.entries(itemsByCategory).map(([category, catItems]) => (
                        <div key={category}>
                             <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 border-b dark:border-gray-600 pb-1 mb-2">{category}</h3>
                             <ul className="space-y-2">
                                {/* FIX: Cast `catItems` to KitChecklistItem[] as Object.entries loses type information. */}
                                {(catItems as KitChecklistItem[]).map(item => (
                                    <li key={`${item.category}-${item.name}`} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                        <span>{item.name} {item.trackable && <span className="text-xs text-blue-500">(Tracked)</span>}</span>
                                        <button onClick={() => handleRemoveItem(item)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                                    </li>
                                ))}
                             </ul>
                        </div>
                    ))}
                </div>
                <div className="flex-shrink-0 pt-4 border-t dark:border-gray-600 mt-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 mb-2">Add New Item</h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                        <div className="md:col-span-2">
                             <label className="text-xs">Item Name</label>
                             <input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className={inputClasses}/>
                        </div>
                        <div>
                            <label className="text-xs">Category</label>
                            <input type="text" list="categories" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className={inputClasses}/>
                             <datalist id="categories">
                                {allCategories.map(cat => <option key={cat} value={cat} />)}
                            </datalist>
                        </div>
                         <div className="flex items-center gap-4">
                            <div className="flex items-center">
                                 <input id="trackable" type="checkbox" checked={newItem.trackable} onChange={e => setNewItem({...newItem, trackable: e.target.checked})} className="h-4 w-4 rounded" />
                                 <label htmlFor="trackable" className="ml-2 text-sm">Trackable?</label>
                            </div>
                            <button type="button" onClick={handleAddItem} className="p-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-5 h-5"/></button>
                         </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button type="button" onClick={handleSubmit} disabled={loading} className="px-6 py-2 bg-ams-blue text-white font-semibold rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                        {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                        Save Checklist
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KitChecklistEditModal;
