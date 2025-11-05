import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Vehicle, Kit } from '../types';
import { listenToVehicles, addVehicle, updateVehicle, deleteVehicle } from '../services/assetService';
import { listenToKits, addKit, updateKit, deleteKit } from '../services/inventoryService';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SpinnerIcon, PlusIcon, TrashIcon, AmbulanceIcon, BoxIcon, RefreshIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import VehicleModal from '../components/VehicleModal';
import KitModal from '../components/KitModal';
import ConfirmationModal from '../components/ConfirmationModal';

const Inventory: React.FC = () => {
    const { isManager } = useAuth();
    const { isOnline } = useOnlineStatus();
    const navigate = ReactRouterDOM.useNavigate();
    const [activeTab, setActiveTab] = useState<'vehicles' | 'kits'>('vehicles');

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [kits, setKits] = useState<Kit[]>([]);
    
    const [loading, setLoading] = useState(true);

    const [isVehicleModalOpen, setVehicleModalOpen] = useState(false);
    const [isKitModalOpen, setKitModalOpen] = useState(false);
    
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [selectedKit, setSelectedKit] = useState<Kit | null>(null);

    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: 'vehicle' | 'kit' } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    useEffect(() => {
        setLoading(true);
        
        const unsubVehicles = listenToVehicles((vehicleList) => {
            setVehicles(vehicleList);
            if (activeTab === 'vehicles') setLoading(false);
        });

        const unsubKits = listenToKits((kitList) => {
            setKits(kitList);
            if (activeTab === 'kits') setLoading(false);
        });

        return () => {
            unsubVehicles();
            unsubKits();
        };
    }, []);

    const handleOpenVehicleModal = (vehicle: Vehicle | null) => { setSelectedVehicle(vehicle); setVehicleModalOpen(true); };
    const handleOpenKitModal = (kit: Kit | null) => { setSelectedKit(kit); setKitModalOpen(true); };
    
    const handleSaveVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'lastCheck'>) => {
        try {
            if (selectedVehicle) {
                await updateVehicle(selectedVehicle.id!, vehicleData);
                showToast("Vehicle updated.", "success");
            } else {
                await addVehicle(vehicleData);
                showToast("Vehicle added.", "success");
            }
        } catch (e) { showToast("Failed to save vehicle.", "error"); }
        finally { setVehicleModalOpen(false); setSelectedVehicle(null); }
    };

    const handleSaveKit = async (kitData: Omit<Kit, 'id' | 'createdAt' | 'lastCheck' | 'assignedTo' | 'qrCodeValue'>) => {
        try {
            if (selectedKit) {
                await updateKit(selectedKit.id!, kitData);
                showToast("Kit updated.", "success");
            } else {
                await addKit(kitData);
                showToast("Kit added.", "success");
            }
        } catch (e) { showToast("Failed to save kit.", "error"); }
        finally { setKitModalOpen(false); setSelectedKit(null); }
    };

    const openDeleteModal = (item: Vehicle | Kit, type: 'vehicle' | 'kit') => {
        setItemToDelete({ id: item.id!, name: item.name, type });
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);
        try {
            if (itemToDelete.type === 'vehicle') {
                await deleteVehicle(itemToDelete.id);
            } else {
                await deleteKit(itemToDelete.id);
            }
            showToast(`${itemToDelete.type === 'vehicle' ? 'Vehicle' : 'Kit'} deleted.`, "success");
            // No need to fetch data, listener will update state
        } catch (error) { showToast("Failed to delete item.", "error"); }
        finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const getStatusColor = (status: Vehicle['status'] | Kit['status']) => {
        switch (status) {
            case 'In Service': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Needs Restocking':
            case 'Maintenance Required': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Out of Service': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'With Crew': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        }
    };

    const renderTable = () => {
        if (loading) {
            return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" /></div>;
        }

        if (activeTab === 'vehicles') {
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Registration</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {vehicles.map(vehicle => (
                                <tr key={vehicle.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">{vehicle.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{vehicle.registration}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{vehicle.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(vehicle.status)}`}>{vehicle.status}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => navigate(`/inventory/vehicle/${vehicle.id}`)} className="text-ams-light-blue hover:text-ams-blue mr-4">View</button>
                                        {isManager && <>
                                            <button onClick={() => isOnline && handleOpenVehicleModal(vehicle)} disabled={!isOnline} className="text-ams-light-blue hover:text-ams-blue mr-4 disabled:opacity-50">Edit</button>
                                            <button onClick={() => isOnline && openDeleteModal(vehicle, 'vehicle')} disabled={!isOnline} className="text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
                                        </>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {vehicles.length === 0 && <p className="text-center py-4 text-gray-500 dark:text-gray-400">No vehicles found.</p>}
                </div>
            );
        }

        if (activeTab === 'kits') {
             return (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Assigned To</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {kits.map(kit => (
                                <tr key={kit.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">{kit.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{kit.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(kit.status)}`}>{kit.status}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{kit.assignedTo?.name || 'In Stores'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => navigate(`/inventory/kit/${kit.id}`)} className="text-ams-light-blue hover:text-ams-blue mr-4">View</button>
                                        {isManager && <>
                                            <button onClick={() => isOnline && handleOpenKitModal(kit)} disabled={!isOnline} className="text-ams-light-blue hover:text-ams-blue mr-4 disabled:opacity-50">Edit</button>
                                            <button onClick={() => isOnline && openDeleteModal(kit, 'kit')} disabled={!isOnline} className="text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
                                        </>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {kits.length === 0 && <p className="text-center py-4 text-gray-500 dark:text-gray-400">No kits found.</p>}
                </div>
            );
        }
        return null;
    };
    
    return (
        <div>
            <VehicleModal isOpen={isVehicleModalOpen} onClose={() => { setVehicleModalOpen(false); setSelectedVehicle(null); }} onSave={handleSaveVehicle} vehicle={selectedVehicle} />
            <KitModal isOpen={isKitModalOpen} onClose={() => { setKitModalOpen(false); setSelectedKit(null); }} onSave={handleSaveKit} kit={selectedKit} />
            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={`Delete ${itemToDelete?.type}`}
                message={`Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                isLoading={isDeleting}
            />
    
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Inventory</h1>
                 <div className="flex items-center gap-2">
                    <button onClick={() => window.location.reload()} className="flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">
                        <RefreshIcon className="w-5 h-5 mr-2" /> Refresh
                    </button>
                    {isManager && <button 
                        onClick={() => activeTab === 'vehicles' ? handleOpenVehicleModal(null) : handleOpenKitModal(null)} 
                        disabled={!isOnline}
                        title={!isOnline ? "You must be online to add new items" : ""}
                        className="flex items-center px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <PlusIcon className="w-5 h-5 mr-2" /> Add New {activeTab === 'vehicles' ? 'Vehicle' : 'Kit'}
                    </button>}
                 </div>
            </div>
            
            {!isOnline && (
                <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md dark:bg-yellow-900 dark:text-yellow-200">
                    <p><span className="font-bold">Offline Mode:</span> You are viewing cached inventory. Real-time updates are paused.</p>
                </div>
            )}
            
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('vehicles')} className={`${activeTab === 'vehicles' ? 'border-ams-light-blue text-ams-blue dark:text-ams-light-blue' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                        <AmbulanceIcon className="w-5 h-5" /> Vehicles
                    </button>
                    <button onClick={() => setActiveTab('kits')} className={`${activeTab === 'kits' ? 'border-ams-light-blue text-ams-blue dark:text-ams-light-blue' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                        <BoxIcon className="w-5 h-5" /> Kits & Bags
                    </button>
                </nav>
            </div>
            
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                {renderTable()}
            </div>
        </div>
    );
};

export default Inventory;