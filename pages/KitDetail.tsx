
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { Kit, KitCheck } from '../types';
import { getKitById, getKitChecks, addKitCheck, updateKit } from '../services/inventoryService';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SpinnerIcon, PlusIcon, CheckIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import KitCheckModal from '../components/KitCheckModal';

const KitDetail: React.FC = () => {
    const { kitId } = useParams<{ kitId: string }>();
    const { user } = useAuth();
    const { isOnline } = useOnlineStatus();
    const [kit, setKit] = useState<Kit | null>(null);
    const [checks, setChecks] = useState<KitCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCheckModalOpen, setCheckModalOpen] = useState(false);
    const [checkType, setCheckType] = useState<'Sign Out' | 'Sign In'>('Sign Out');

    const fetchData = async () => {
        if (!kitId) return;
        setLoading(true);
        try {
            const [kitData, checksData] = await Promise.all([
                getKitById(kitId),
                getKitChecks(kitId),
            ]);
            setKit(kitData);
            setChecks(checksData);
        } catch (error) {
             if (isOnline) {
                showToast("Failed to load kit data.", "error");
             }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [kitId, isOnline]);
    
    const handleSaveCheck = async (checkData: Omit<KitCheck, 'id' | 'date'>) => {
        if (!kitId || !user) return;
        try {
            await addKitCheck(kitId, checkData);
            showToast("Kit check submitted successfully.", "success");
            fetchData(); // Refresh data
        } catch(e) {
            showToast("Failed to submit kit check.", "error");
        } finally {
            setCheckModalOpen(false);
        }
    };
    
    const handleOpenCheckModal = (type: 'Sign Out' | 'Sign In') => {
        setCheckType(type);
        setCheckModalOpen(true);
    }

    if (loading) {
        return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /></div>;
    }

    if (!kit) {
        return <div className="text-center p-10 text-xl text-gray-600 dark:text-gray-300">Kit not found.</div>;
    }

    const getStatusChip = (status: Kit['status']) => {
        switch(status) {
            case 'In Service': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Needs Restocking': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Out of Service': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'With Crew': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        }
    };
    
    return (
        <div>
             {isCheckModalOpen && kit && user && (
                <KitCheckModal 
                    isOpen={isCheckModalOpen}
                    onClose={() => setCheckModalOpen(false)}
                    onSave={handleSaveCheck}
                    kit={kit}
                    user={user}
                    type={checkType}
                />
            )}
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                 <div>
                    <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">{kit.name}</h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400">{kit.type}</p>
                 </div>
                 {kit.status !== 'With Crew' ? (
                     <button onClick={() => handleOpenCheckModal('Sign Out')} disabled={!isOnline} className="flex items-center px-6 py-3 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400">
                        <PlusIcon className="w-6 h-6 mr-2"/> Sign Out Kit
                     </button>
                 ) : kit.assignedTo?.uid === user?.uid && (
                     <button onClick={() => handleOpenCheckModal('Sign In')} disabled={!isOnline} className="flex items-center px-6 py-3 bg-ams-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400">
                        <CheckIcon className="w-6 h-6 mr-2"/> Sign In Kit
                     </button>
                 )}
            </div>
            
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Details</h3>
                    <p className="flex items-center gap-2"><strong>Status:</strong> <span className={`px-2 py-0.5 text-sm font-semibold rounded-full ${getStatusChip(kit.status)}`}>{kit.status}</span></p>
                    <p><strong>Assigned To:</strong> {kit.assignedTo?.name || 'In Stores'}</p>
                    {kit.lastCheck && (
                         <div className="mt-4 pt-4 border-t dark:border-gray-700">
                             <p className="font-semibold">Last Check:</p>
                             <p>{kit.lastCheck.date.toDate().toLocaleString()}</p>
                             <p>by {kit.lastCheck.user.name}</p>
                             <p className={`font-bold ${kit.lastCheck.status === 'Pass' ? 'text-green-600' : 'text-yellow-600'}`}>{kit.lastCheck.status}</p>
                         </div>
                    )}
                </div>
                 <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                     <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Recent Checks</h3>
                     {checks.length > 0 ? (
                        <ul className="space-y-4 max-h-96 overflow-y-auto">
                            {checks.map(check => (
                                <li key={check.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold dark:text-gray-200">{check.date.toDate().toLocaleString()}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">by {check.user.name} - <span className="font-medium">{check.type}</span></p>
                                            {check.notes && <p className="text-sm mt-2 pt-2 border-t dark:border-gray-600 italic">"{check.notes}"</p>}
                                        </div>
                                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${check.overallStatus === 'Pass' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                             {check.overallStatus === 'Pass' && <CheckIcon className="w-4 h-4"/>}
                                            {check.overallStatus}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                     ) : (
                        <p className="text-gray-500 dark:text-gray-400">No checks have been recorded for this kit.</p>
                     )}
                 </div>
             </div>
        </div>
    );
};

export default KitDetail;
