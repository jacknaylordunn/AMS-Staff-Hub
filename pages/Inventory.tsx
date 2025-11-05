

import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Vehicle, Kit } from '../types';
import { getVehicles, addVehicle, updateVehicle, deleteVehicle } from '../services/assetService';
import { getKits, addKit, updateKit, deleteKit } from '../services/inventoryService';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SpinnerIcon, PlusIcon, TrashIcon, AmbulanceIcon, BoxIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import VehicleModal from '../components/VehicleModal';
import KitModal from '../components/KitModal';
import ConfirmationModal from '../components/ConfirmationModal';

const Inventory: React.FC = () => {
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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vehicleList, kitList] = await Promise.all([getVehicles(), getKits()]);
            setVehicles(vehicleList);
            setKits(kitList);
        } catch (error) {
            if (isOnline) {
                showToast("Failed to fetch inventory.", "error");
            }
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, [isOnline]);

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
            fetchData();
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
            fetchData();
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
            fetchData();
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

        if