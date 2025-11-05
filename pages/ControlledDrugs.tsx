import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getLedgerEntries } from '../services/drugLedgerService';
import type { ControlledDrugLedgerEntry, User } from '../types';
import { SpinnerIcon, PlusIcon, PillIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import DrugLedgerModal from '../components/DrugLedgerModal';
import { getUsers } from '../services/userService';

const ControlledDrugs: React.FC = () => {
    const { user } = useAuth();
    const [entries, setEntries] = useState<ControlledDrugLedgerEntry[]>([]);
    const [allStaff, setAllStaff] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [modalAction, setModalAction] = useState<ControlledDrugLedgerEntry['type']>('Administered');

    useEffect(() => {
        const unsubscribe = getLedgerEntries((newEntries) => {
            setEntries(newEntries);
            setLoading(false);
        });

        getUsers().then(users => {
            const seniorClinicians = users.filter(u => ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'].includes(u.role || ''));
            setAllStaff(seniorClinicians);
        });

        return () => unsubscribe();
    }, []);
    
    const handleOpenModal = (action: ControlledDrugLedgerEntry['type']) => {
        setModalAction(action);
        setModalOpen(true);
    };

    const getTypeChip = (type: ControlledDrugLedgerEntry['type']) => {
        switch(type) {
            case 'Administered': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'Wasted': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Received': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Moved': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'Balance Check': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div>
            {user && (
                <DrugLedgerModal
                    isOpen={isModalOpen}
                    onClose={() => setModalOpen(false)}
                    action={modalAction}
                    user={user}
                    witnesses={allStaff.filter(s => s.uid !== user.uid)}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Controlled Drugs Ledger</h1>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleOpenModal('Administered')} className="flex items-center px-3 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1" /> Administer</button>
                    <button onClick={() => handleOpenModal('Wasted')} className="flex items-center px-3 py-2 text-sm bg-yellow-500 text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1" /> Waste</button>
                    <button onClick={() => handleOpenModal('Received')} className="flex items-center px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1" /> Receive Stock</button>
                    <button onClick={() => handleOpenModal('Moved')} className="flex items-center px-3 py-2 text-sm bg-purple-500 text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1" /> Move Stock</button>
                    <button onClick={() => handleOpenModal('Balance Check')} className="flex items-center px-3 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-opacity-90"><PillIcon className="w-4 h-4 mr-1" /> Balance Check</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                {loading ? (
                    <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    {['Date', 'Drug', 'Type', 'Details', 'User', 'Witness'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {entries.map(entry => (
                                    <tr key={entry.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{entry.timestamp.toDate().toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">{entry.drugName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeChip(entry.type)}`}>
                                                {entry.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {entry.type === 'Administered' && `To ${entry.patientName} (${entry.doseAdministered})`}
                                            {entry.type === 'Wasted' && `Wasted: ${entry.wastedAmount}`}
                                            {entry.type === 'Received' && `Received ${entry.quantity} into ${entry.toLocation}`}
                                            {entry.type === 'Moved' && `Moved ${entry.quantity} from ${entry.fromLocation} to ${entry.toLocation}`}
                                            {entry.type === 'Balance Check' && `Balance: ${entry.balanceChecked}`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{entry.user1.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{entry.user2?.name || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {entries.length === 0 && <div className="text-center py-10 text-gray-500 dark:text-gray-400">No ledger entries found.</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ControlledDrugs;
