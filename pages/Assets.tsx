import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Vehicle } from '../types';
import { getVehicles, addVehicle, updateVehicle, deleteVehicle } from '../services/firestoreService';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SpinnerIcon, PlusIcon, TrashIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import VehicleModal from '../components/VehicleModal';
import ConfirmationModal from '../components/ConfirmationModal';

const Assets: React.FC = () => {
    const { isOnline } = useOnlineStatus();
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const vehicleList = await getVehicles();
            setVehicles(vehicleList);
        } catch (error) {
            if (isOnline) {
                showToast("Failed to fetch vehicles.", "error");
            }
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchVehicles();
    }, [isOnline]);

    const handleOpenModal = (vehicle: Vehicle | null) => {
        setSelectedVehicle(vehicle);
        setModalOpen(true);
    }
    
    const handleSaveVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'lastCheck'>) => {
        try {
            if (selectedVehicle) {
                await updateVehicle(selectedVehicle.id!, vehicleData);
                showToast("Vehicle updated.", "success");
            } else {
                await addVehicle(vehicleData);
                showToast("Vehicle added.", "success");
            }
            fetchVehicles();
        } catch (e) {
            showToast("Failed to save vehicle.", "error");
        } finally {
            setModalOpen(false);
            setSelectedVehicle(null);
        }
    };

    const openDeleteModal = (vehicle: Vehicle) => {
        setVehicleToDelete(vehicle);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!vehicleToDelete) return;
        setIsDeleting(true);
        try {
            await deleteVehicle(vehicleToDelete.id!);
            showToast("Vehicle deleted.", "success");
            setVehicles(prev => prev.filter(v => v.id !== vehicleToDelete.id));
        } catch (error) {
            showToast("Failed to delete vehicle.", "error");
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
            setVehicleToDelete(null);
        }
    }

    const getStatusColor = (status: Vehicle['status']) => {
        switch (status) {
            case 'In Service': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Maintenance Required': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Out of Service': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        }
    }

    return (
        <div>
            <VehicleModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveVehicle} vehicle={selectedVehicle} />
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Delete Vehicle" message={`Are you sure you want to delete ${vehicleToDelete?.name}? This action cannot be undone.`} confirmText="Delete" isLoading={isDeleting}/>
            
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                 <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Asset Management</h1>
                 <button onClick={() => handleOpenModal(null)} disabled={!isOnline} className="flex items-center px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400">
                     <PlusIcon className="w-5 h-5 mr-2" /> Add New Vehicle
                 </button>
            </div>
            {!isOnline && (
                <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md dark:bg-yellow-900 dark:text-yellow-200">
                    <p><span className="font-bold">Offline Mode:</span> You are viewing cached data. Please reconnect to make changes.</p>
                </div>
            )}
            
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                 {loading ? (
                    <div className="flex justify-center items-center p-10">
                        <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
                    </div>
                 ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    {['Name', 'Registration', 'Type', 'Status', 'Last Check', 'Actions'].map(header => (
                                         <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {vehicles.map(vehicle => (
                                    <tr key={vehicle.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">{vehicle.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{vehicle.registration}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{vehicle.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(vehicle.status)}`}>
                                                {vehicle.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {vehicle.lastCheck ? `${vehicle.lastCheck.date.toDate().toLocaleDateString()} by ${vehicle.lastCheck.user.name}` : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                                            <button onClick={() => navigate(`/assets/vehicle/${vehicle.id}`)} className="text-ams-light-blue hover:text-ams-blue">View/Check</button>
                                            <button onClick={() => handleOpenModal(vehicle)} disabled={!isOnline} className="text-gray-500 hover:text-gray-700 disabled:opacity-50">Edit</button>
                                            <button onClick={() => openDeleteModal(vehicle)} disabled={!isOnline} className="text-red-500 hover:text-red-700 disabled:opacity-50"><TrashIcon className="w-4 h-4 inline"/></button>
                                        </td>
                                    </tr>
                                ))}
                             </tbody>
                        </table>
                    </div>
                 )}
                 {!loading && vehicles.length === 0 && (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                        No vehicles found.
                    </div>
                 )}
            </div>
        </div>
    );
};

export default Assets;