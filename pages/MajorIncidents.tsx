import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { getIncidents } from '../services/majorIncidentService';
import type { MajorIncident } from '../types';
import { useAuth } from '../hooks/useAuth';
import { SpinnerIcon, PlusIcon, ShieldExclamationIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import DeclareIncidentModal from '../components/DeclareIncidentModal';

const MajorIncidents: React.FC = () => {
    const { user } = useAuth();
    const [incidents, setIncidents] = useState<MajorIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const navigate = ReactRouterDOM.useNavigate();

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const incidentList = await getIncidents();
            setIncidents(incidentList);
        } catch (error) {
            console.error("Failed to fetch incidents:", error);
            showToast("Could not load incidents.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIncidents();
    }, []);

    const handleSave = (incidentId: string) => {
        fetchIncidents(); // Refresh list after save
        setModalOpen(false);
        navigate(`/major-incidents/${incidentId}`);
    };

    const getStatusChip = (status: MajorIncident['status']) => {
        switch(status) {
            case 'Active': return 'bg-red-100 text-red-800 animate-pulse';
            case 'Stood Down': return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div>
            {user && <DeclareIncidentModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} declarer={user} />}

            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Major Incidents</h1>
                <button 
                    onClick={() => setModalOpen(true)} 
                    className="flex items-center px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow hover:bg-red-700">
                    <ShieldExclamationIcon className="w-5 h-5 mr-2" /> Declare New Incident
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" /></div>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {incidents.length > 0 ? incidents.map(incident => (
                            <li key={incident.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                               <div className="px-4 py-4 sm:px-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-md font-bold text-ams-blue dark:text-ams-light-blue truncate">{incident.name}</p>
                                        <div className="ml-2 flex-shrink-0 flex">
                                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(incident.status)}`}>
                                                {incident.status}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 sm:flex sm:justify-between">
                                        <div className="sm:flex">
                                            <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                                {incident.location}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 sm:mt-0">
                                            <p>{incident.declaredAt.toDate().toLocaleString()}</p>
                                        </div>
                                    </div>
                                     <div className="mt-2 flex justify-end">
                                        <button onClick={() => navigate(`/major-incidents/${incident.id}`)} className="text-sm font-semibold text-ams-light-blue hover:underline">
                                            View Dashboard
                                        </button>
                                     </div>
                               </div>
                            </li>
                        )) : (
                            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                                No incidents have been recorded.
                            </div>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MajorIncidents;
