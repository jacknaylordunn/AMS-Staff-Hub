import React, { useState } from 'react';
import { SpinnerIcon } from './icons';
import { DRUG_DATABASE } from '../utils/drugDatabase';

type QuickAddType = 'vital' | 'med' | 'int';

interface QuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (type: QuickAddType, data: any) => void;
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState<QuickAddType>('vital');
    const [loading, setLoading] = useState(false);

    const timeNow = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // State for each form
    const [vital, setVital] = useState({ time: timeNow, hr: '', rr: '', bp: '', spo2: '', temp: '', bg: '', painScore: '0', avpu: 'Alert' as const, onOxygen: false });
    const [med, setMed] = useState({ time: timeNow, medication: '', dose: '', route: 'PO' as const });
    const [intervention, setIntervention] = useState({ time: timeNow, intervention: '', details: '' });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        switch (activeTab) {
            case 'vital':
                onSave('vital', { ...vital, id: Date.now().toString() });
                setVital({ time: timeNow, hr: '', rr: '', bp: '', spo2: '', temp: '', bg: '', painScore: '0', avpu: 'Alert', onOxygen: false });
                break;
            case 'med':
                onSave('med', { ...med, id: Date.now().toString() });
                setMed({ time: timeNow, medication: '', dose: '', route: 'PO' });
                break;
            case 'int':
                onSave('int', { ...intervention, id: Date.now().toString() });
                setIntervention({ time: timeNow, intervention: '', details: '' });
                break;
        }
        setLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    const renderForm = () => {
        switch (activeTab) {
            case 'vital':
                return (
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div><label className={labelClasses}>Time</label><input type="time" value={vital.time} onChange={e => setVital({...vital, time: e.target.value})} className={inputClasses}/></div>
                        <div><label className={labelClasses}>HR</label><input type="text" value={vital.hr} onChange={e => setVital({...vital, hr: e.target.value})} className={inputClasses}/></div>
                        <div><label className={labelClasses}>RR</label><input type="text" value={vital.rr} onChange={e => setVital({...vital, rr: e.target.value})} className={inputClasses}/></div>
                        <div><label className={labelClasses}>BP</label><input type="text" value={vital.bp} onChange={e => setVital({...vital, bp: e.target.value})} className={inputClasses}/></div>
                        <div><label className={labelClasses}>SpO2</label><input type="text" value={vital.spo2} onChange={e => setVital({...vital, spo2: e.target.value})} className={inputClasses}/></div>
                        <div><label className={labelClasses}>Temp</label><input type="text" value={vital.temp} onChange={e => setVital({...vital, temp: e.target.value})} className={inputClasses}/></div>
                        <div className="flex items-center sm:col-span-3"><input type="checkbox" checked={vital.onOxygen} onChange={e => setVital({...vital, onOxygen: e.target.checked})} className="h-4 w-4 mr-2" /><label className={labelClasses}>Patient on Oxygen</label></div>
                    </div>
                );
            case 'med':
                return (
                    <div className="space-y-4">
                        <datalist id="drug-db-list-quickadd">
                            {DRUG_DATABASE.map(med => <option key={med} value={med} />)}
                        </datalist>
                        <div><label className={labelClasses}>Time</label><input type="time" value={med.time} onChange={e => setMed({...med, time: e.target.value})} className={inputClasses}/></div>
                        <div><label className={labelClasses}>Medication</label><input type="text" list="drug-db-list-quickadd" value={med.medication} onChange={e => setMed({...med, medication: e.target.value})} className={inputClasses} required/></div>
                        <div><label className={labelClasses}>Dose</label><input type="text" value={med.dose} onChange={e => setMed({...med, dose: e.target.value})} className={inputClasses} required/></div>
                        <div><label className={labelClasses}>Route</label>
                            <select value={med.route} onChange={e => setMed({...med, route: e.target.value as any})} className={inputClasses}>
                                <option>PO</option><option>IV</option><option>IM</option><option>SC</option><option>SL</option><option>PR</option><option>Nebulised</option><option>Other</option>
                            </select>
                        </div>
                    </div>
                );
            case 'int':
                return (
                     <div className="space-y-4">
                        <div><label className={labelClasses}>Time</label><input type="time" value={intervention.time} onChange={e => setIntervention({...intervention, time: e.target.value})} className={inputClasses}/></div>
                        <div><label className={labelClasses}>Intervention</label><input type="text" value={intervention.intervention} onChange={e => setIntervention({...intervention, intervention: e.target.value})} className={inputClasses} required/></div>
                        <div><label className={labelClasses}>Details</label><textarea value={intervention.details} onChange={e => setIntervention({...intervention, details: e.target.value})} className={inputClasses} rows={3}/></div>
                    </div>
                );
        }
    };
    
    const tabs: {id: QuickAddType, label: string}[] = [{id: 'vital', label: 'Vitals'}, {id: 'med', label: 'Medication'}, {id: 'int', label: 'Intervention'}];

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-start pt-20 modal-overlay" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl max-h-[80vh] overflow-y-auto modal-content" onClick={e => e.stopPropagation()}>
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-4 px-6" aria-label="Tabs">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`${tab.id === activeTab
                                    ? 'border-ams-light-blue text-ams-blue dark:text-ams-light-blue'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
                <form onSubmit={handleSave} className="p-6">
                    {renderForm()}
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                            Add Entry
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuickAddModal;