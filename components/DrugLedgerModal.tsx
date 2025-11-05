import React, { useState, useEffect } from 'react';
import type { ControlledDrugLedgerEntry, User } from '../types';
import { addLedgerEntry } from '../services/drugLedgerService';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface DrugLedgerModalProps {
    isOpen: boolean;
    onClose: () => void;
    action: ControlledDrugLedgerEntry['type'];
    user: User;
    witnesses: User[];
}

const DrugLedgerModal: React.FC<DrugLedgerModalProps> = ({ isOpen, onClose, action, user, witnesses }) => {
    const initialState = {
        drugName: 'Morphine Sulphate 10mg/1ml' as ControlledDrugLedgerEntry['drugName'],
        batchNumber: '',
        expiryDate: '',
        fromLocation: 'Safe',
        toLocation: 'Drug Kit 1',
        quantity: 1,
        patientName: '',
        doseAdministered: '',
        wastedAmount: '',
        balanceChecked: 0,
        witnessUid: '',
        notes: '',
    };
    const [formData, setFormData] = useState(initialState);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setFormData(initialState); // Reset form when action changes
    }, [action, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const val = name === 'quantity' || name === 'balanceChecked' ? Number(value) : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.witnessUid) {
            showToast("A witness is required for all controlled drug transactions.", "error");
            return;
        }
        setLoading(true);
        const witness = witnesses.find(w => w.uid === formData.witnessUid);
        if (!witness) {
             showToast("Invalid witness selected.", "error");
             setLoading(false);
             return;
        }

        const commonData = {
            drugName: formData.drugName,
            batchNumber: formData.batchNumber,
            expiryDate: formData.expiryDate,
            user1: { uid: user.uid, name: `${user.firstName} ${user.lastName}`.trim() },
            user2: { uid: witness.uid, name: `${witness.firstName} ${witness.lastName}`.trim() },
            notes: formData.notes,
        };
        
        let entryData: Omit<ControlledDrugLedgerEntry, 'id' | 'timestamp'>;

        switch(action) {
            case 'Administered':
                entryData = { ...commonData, type: 'Administered', patientName: formData.patientName, doseAdministered: formData.doseAdministered };
                break;
            case 'Wasted':
                entryData = { ...commonData, type: 'Wasted', wastedAmount: formData.wastedAmount };
                break;
            case 'Received':
                entryData = { ...commonData, type: 'Received', fromLocation: formData.fromLocation, toLocation: formData.toLocation, quantity: formData.quantity };
                break;
            case 'Moved':
                entryData = { ...commonData, type: 'Moved', fromLocation: formData.fromLocation, toLocation: formData.toLocation, quantity: formData.quantity };
                break;
            case 'Balance Check':
                entryData = { ...commonData, type: 'Balance Check', balanceChecked: formData.balanceChecked };
                break;
            default:
                showToast("Invalid action.", "error");
                setLoading(false);
                return;
        }

        try {
            await addLedgerEntry(entryData);
            showToast("Ledger entry added successfully.", "success");
            onClose();
        } catch (error) {
            showToast("Failed to save ledger entry.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    const renderActionFields = () => {
        switch(action) {
            case 'Administered':
                return <>
                    <div><label className={labelClasses}>Patient Name / ID</label><input type="text" name="patientName" value={formData.patientName} onChange={handleChange} required className={inputClasses}/></div>
                    <div><label className={labelClasses}>Dose Administered</label><input type="text" name="doseAdministered" value={formData.doseAdministered} onChange={handleChange} required className={inputClasses} placeholder="e.g., 5mg"/></div>
                </>;
            case 'Wasted':
                return <div><label className={labelClasses}>Amount Wasted</label><input type="text" name="wastedAmount" value={formData.wastedAmount} onChange={handleChange} required className={inputClasses} placeholder="e.g., 5mg / 0.5ml"/></div>;
            case 'Received':
            case 'Moved':
                return <>
                    <div><label className={labelClasses}>Quantity (Vials/Amps)</label><input type="number" name="quantity" value={formData.quantity} onChange={handleChange} required min="1" className={inputClasses}/></div>
                    <div><label className={labelClasses}>From Location</label><input type="text" name="fromLocation" value={formData.fromLocation} onChange={handleChange} required className={inputClasses}/></div>
                    <div><label className={labelClasses}>To Location</label><input type="text" name="toLocation" value={formData.toLocation} onChange={handleChange} required className={inputClasses}/></div>
                </>;
            case 'Balance Check':
                 return <div><label className={labelClasses}>Balance Checked</label><input type="number" name="balanceChecked" value={formData.balanceChecked} onChange={handleChange} required min="0" className={inputClasses}/></div>;
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center modal-overlay" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">New Ledger Entry: {action}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2"><label className={labelClasses}>Drug</label><select name="drugName" value={formData.drugName} onChange={handleChange} className={inputClasses}><option>Morphine Sulphate 10mg/1ml</option><option>Diazepam 10mg/2ml</option><option>Midazolam 10mg/2ml</option><option>Ketamine 100mg/2ml</option></select></div>
                        <div><label className={labelClasses}>Batch Number</label><input type="text" name="batchNumber" value={formData.batchNumber} onChange={handleChange} required className={inputClasses}/></div>
                        <div><label className={labelClasses}>Expiry Date</label><input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} required className={inputClasses}/></div>
                        
                        {renderActionFields()}

                        <div className="md:col-span-2"><label className={labelClasses}>Witness</label><select name="witnessUid" value={formData.witnessUid} onChange={handleChange} required className={inputClasses}><option value="">Select witness...</option>{witnesses.map(w => <option key={w.uid} value={w.uid}>{w.firstName} {w.lastName}</option>)}</select></div>
                        <div className="md:col-span-2"><label className={labelClasses}>Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className={inputClasses}/></div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Save Entry
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DrugLedgerModal;