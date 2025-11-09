import React, { useState } from 'react';
import type { User } from '../types';
import { SpinnerIcon } from './icons';

interface ControlledDrugWitnessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (witnessData: { witness: { uid: string, name: string }, batchNumber: string, amountWasted: string }) => void;
    witnesses: User[];
}

const ControlledDrugWitnessModal: React.FC<ControlledDrugWitnessModalProps> = ({ isOpen, onClose, onSave, witnesses }) => {
    const [witnessUid, setWitnessUid] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [amountWasted, setAmountWasted] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const witness = witnesses.find(w => w.uid === witnessUid);
        if (!witness) {
            // This should not happen with a dropdown, but good to have.
            return;
        }
        onSave({
            witness: { uid: witness.uid, name: `${witness.firstName} ${witness.lastName}`.trim() },
            batchNumber,
            amountWasted
        });
        onClose();
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center modal-overlay"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-yellow-500 mb-4">Controlled Drug Administration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">A second clinician is required to witness the administration and wastage of this drug.</p>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Witnessing Clinician*</label>
                            <select value={witnessUid} onChange={e => setWitnessUid(e.target.value)} required className={inputClasses}>
                                <option value="">Select a witness...</option>
                                {witnesses.map(w => <option key={w.uid} value={w.uid}>{w.firstName} {w.lastName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Batch Number*</label>
                            <input type="text" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} required className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>Amount Wasted (if any)</label>
                            <input type="text" value={amountWasted} onChange={e => setAmountWasted(e.target.value)} className={inputClasses} placeholder="e.g., 5mg / 0.5ml"/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Confirm & Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ControlledDrugWitnessModal;
