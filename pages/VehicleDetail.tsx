import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Vehicle, VehicleCheck } from '../types';
import { getVehicleById, getVehicleChecks, addVehicleCheck, updateVehicle } from '../services/assetService';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SpinnerIcon, PlusIcon, CheckIcon, QrCodeIcon, CopyIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import VehicleCheckModal from '../components/VehicleCheckModal';

const VehicleDetail: React.FC = () => {
    const { vehicleId } = ReactRouterDOM.useParams<{ vehicleId: string }>();
    const { user, isManager } = useAuth();
    const { isOnline } = useOnlineStatus();
    const navigate = ReactRouterDOM.useNavigate();
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [checks, setChecks] = useState<VehicleCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCheckModalOpen, setCheckModalOpen] = useState(false);

    const fetchData = async () => {
        if (!vehicleId) return;
        setLoading(true);
        try {
            const [vehicleData, checksData] = await Promise.all([
                getVehicleById(vehicleId),
                getVehicleChecks(vehicleId),
            ]);
            setVehicle(vehicleData);
            setChecks(checksData);
        } catch (error) {
             if (isOnline) {
                showToast("Failed to load vehicle data.", "error");
             }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [vehicleId, isOnline]);
    
    const handleSaveCheck = async (checkData: Omit<VehicleCheck, 'id' | 'date'>) => {
        if (!vehicleId || !user) return;
        try {
            await addVehicleCheck(vehicleId, checkData);
            showToast("Vehicle check submitted successfully.", "success");
            fetchData(); // Refresh data
        } catch(e) {
            showToast("Failed to submit vehicle check.", "error");
        } finally {
            setCheckModalOpen(false);
        }
    }

    const handlePrintQr = () => {
        if (vehicle) {
            navigate(`/print/vehicle/${vehicle.id}`);
        }
    };

    const handleGenerateQr = async () => {
        if (!vehicle || !vehicle.id || !isManager) return;
        const qrCodeValue = `aegis-vehicle-qr:${vehicle.id}`;
        try {
            await updateVehicle(vehicle.id, { qrCodeValue });
            showToast("QR Code generated successfully!", "success");
            fetchData(); // Reload data to show the new QR code
        } catch (e) {
            showToast("Failed to generate QR Code.", "error");
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /></div>;
    }

    if (!vehicle) {
        return <div className="text-center p-10 text-xl text-gray-600 dark:text-gray-300">Vehicle not found.</div>;
    }

    const getStatusChip = (status: Vehicle['status']) => {
        switch(status) {
            case 'In Service': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Maintenance Required': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Out of Service': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        }
    };
    
    return (
        <div>
             {isCheckModalOpen && vehicle && user && (
                <VehicleCheckModal 
                    isOpen={isCheckModalOpen}
                    onClose={() => setCheckModalOpen(false)}
                    onSave={handleSaveCheck}
                    vehicle={vehicle}
                    user={user}
                />
            )}
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                 <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">{vehicle.name} <span className="text-2xl text-gray-500">{vehicle.registration}</span></h1>
                 <button onClick={() => setCheckModalOpen(true)} disabled={!isOnline} className="flex items-center px-6 py-3 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400">
                    <PlusIcon className="w-6 h-6 mr-2"/> Perform Vehicle Check
                 </button>
            </div>
            
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Details</h3>
                        <p><strong>Type:</strong> {vehicle.type}</p>
                        <p className="flex items-center gap-2"><strong>Status:</strong> <span className={`px-2 py-0.5 text-sm font-semibold rounded-full ${getStatusChip(vehicle.status)}`}>{vehicle.status}</span></p>
                        {vehicle.lastCheck && (
                            <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                <p className="font-semibold">Last Check:</p>
                                <p>{vehicle.lastCheck.date.toDate().toLocaleString()}</p>
                                <p>by {vehicle.lastCheck.user.name}</p>
                                <p className={`font-bold ${vehicle.lastCheck.status === 'Pass' ? 'text-green-600' : 'text-yellow-600'}`}>{vehicle.lastCheck.status}</p>
                            </div>
                        )}
                        <div className="mt-4 pt-4 border-t dark:border-gray-700">
                            <h4 className="font-semibold text-sm uppercase text-gray-500 dark:text-gray-400 mb-2">Asset QR Code</h4>
                            {vehicle.qrCodeValue ? (
                                <>
                                    <div className="flex justify-center">
                                        <img 
                                            id="qr-code-img" 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(vehicle.qrCodeValue)}`} 
                                            alt="Vehicle QR Code"
                                        />
                                    </div>
                                    <div className="flex items-center justify-center gap-1 mt-2">
                                        <p className="text-xs text-gray-500 font-mono break-all">{vehicle.qrCodeValue}</p>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(vehicle.qrCodeValue!);
                                                showToast('QR Value Copied!', 'success');
                                            }}
                                            className="p-1 text-gray-400 hover:text-ams-blue"
                                            title="Copy QR Value"
                                        >
                                            <CopyIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button onClick={handlePrintQr} className="mt-2 w-full px-4 py-2 bg-gray-200 dark:bg-gray-600 text-sm font-semibold rounded-md hover:bg-gray-300">
                                        Print
                                    </button>
                                </>
                            ) : isManager ? (
                                <button onClick={handleGenerateQr} className="w-full px-4 py-2 bg-ams-blue text-white rounded-md">
                                    Generate QR Code
                                </button>
                            ) : (
                                <p className="text-sm text-gray-500">No QR code assigned.</p>
                            )}
                        </div>
                    </div>
                </div>
                 <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                     <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Recent Checks</h3>
                     {checks.length > 0 ? (
                        <ul className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {checks.map(check => (
                                <li key={check.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold dark:text-gray-200">{check.date.toDate().toLocaleString()}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">by {check.user.name}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Mileage: {check.mileage} | Fuel: {check.fuelLevel}</p>
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
                        <p className="text-gray-500 dark:text-gray-400">No checks have been recorded for this vehicle.</p>
                     )}
                 </div>
             </div>
        </div>
    );
};

export default VehicleDetail;