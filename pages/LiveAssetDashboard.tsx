import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenToVehicles } from '../services/assetService';
import { listenToKits } from '../services/inventoryService';
import type { Vehicle, Kit } from '../types';
import { SpinnerIcon, AmbulanceIcon, BoxIcon } from '../components/icons';

const LiveAssetDashboard: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [kits, setKits] = useState<Kit[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        const unsubVehicles = listenToVehicles(setVehicles);
        const unsubKits = listenToKits(kitList => {
            setKits(kitList);
            setLoading(false); // Set loading to false after kits (last one) are loaded
        });

        return () => {
            unsubVehicles();
            unsubKits();
        };
    }, []);

    const getStatusChip = (status: Vehicle['status'] | Kit['status']) => {
        switch (status) {
            case 'In Service': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Needs Restocking':
            case 'Maintenance Required': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Out of Service': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'With Crew': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        }
    };
    
    if (loading) return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-12 h-12 text-ams-blue" /></div>;

    return (
        <div>
             <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Live Asset Dashboard</h1>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Vehicles Column */}
                 <div>
                     <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><AmbulanceIcon className="w-6 h-6 mr-3 text-ams-blue dark:text-ams-light-blue" /> Vehicles</h2>
                     <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                        {vehicles.map(v => (
                            <div key={v.id} onClick={() => navigate(`/inventory/vehicle/${v.id}`)} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md cursor-pointer">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{v.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{v.registration}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusChip(v.status)}`}>{v.status}</span>
                                </div>
                            </div>
                        ))}
                     </div>
                 </div>
                 {/* Kits Column */}
                 <div>
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center"><BoxIcon className="w-6 h-6 mr-3 text-ams-blue dark:text-ams-light-blue" /> Kits & Bags</h2>
                     <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                        {kits.map(k => (
                             <div key={k.id} onClick={() => navigate(`/inventory/kit/${k.id}`)} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md cursor-pointer">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{k.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{k.type}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusChip(k.status)}`}>{k.status}</span>
                                </div>
                                {k.assignedTo && (
                                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-300 font-medium">With: {k.assignedTo.name}</p>
                                )}
                            </div>
                        ))}
                     </div>
                 </div>
             </div>
        </div>
    );
};

export default LiveAssetDashboard;
