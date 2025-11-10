import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getShiftById } from '../services/rotaService';
import { getVehicleById, addVehicleCheck } from '../services/assetService';
import { getKitById, addKitCheck } from '../services/inventoryService';
import type { Shift, Vehicle, Kit, VehicleCheck, KitCheck } from '../types';
import { SpinnerIcon, RotaIcon, ClockIcon, PatientsIcon, AmbulanceIcon, BoxIcon, CheckIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import VehicleCheckModal from '../components/VehicleCheckModal';
import KitCheckModal from '../components/KitCheckModal';

const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className }) => (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}>
        <div className="flex items-center">
            <div className="p-3 rounded-full bg-ams-blue/10 text-ams-blue dark:bg-ams-light-blue/20 dark:text-ams-light-blue">
                {icon}
            </div>
            <h3 className="ml-4 text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <div className="mt-4 text-gray-600 dark:text-gray-300 space-y-2">
            {children}
        </div>
    </div>
);

const EventBrief: React.FC = () => {
    const { shiftId } = useParams<{ shiftId: string }>();
    const { user } = useAuth();
    const [shift, setShift] = useState<Shift | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [kits, setKits] = useState<Kit[]>([]);
    const [loading, setLoading] = useState(true);

    const [isVehicleCheckModalOpen, setVehicleCheckModalOpen] = useState(false);
    const [isKitCheckModalOpen, setKitCheckModalOpen] = useState(false);
    const [selectedKitForCheck, setSelectedKitForCheck] = useState<Kit | null>(null);

    const fetchData = async () => {
        if (!shiftId) {
            setLoading(false);
            showToast("Shift ID not found.", "error");
            return;
        }

        setLoading(true);
        try {
            const shiftData = await getShiftById(shiftId);
            if (!shiftData) {
                showToast("Shift not found.", "error");
                setLoading(false);
                return;
            }
            setShift(shiftData);

            const promises: Promise<any>[] = [];
            if (shiftData.assignedVehicleId) {
                promises.push(getVehicleById(shiftData.assignedVehicleId));
            } else {
                promises.push(Promise.resolve(null));
            }
            if (shiftData.assignedKitIds && shiftData.assignedKitIds.length > 0) {
                const kitPromises = shiftData.assignedKitIds.map(id => getKitById(id));
                promises.push(Promise.all(kitPromises));
            } else {
                promises.push(Promise.resolve([]));
            }

            const [vehicleData, kitsData] = await Promise.all(promises);
            
            setVehicle(vehicleData as Vehicle | null);
            setKits((kitsData as (Kit | null)[]).filter(Boolean) as Kit[]);

        } catch (err) {
            console.error("Failed to fetch brief data:", err);
            showToast("Failed to load event brief.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [shiftId]);

    const handleSaveVehicleCheck = async (checkData: Omit<VehicleCheck, 'id' | 'date'>) => {
        if (!shift?.assignedVehicleId || !user) return;
        try {
            await addVehicleCheck(shift.assignedVehicleId, checkData);
            showToast("Vehicle check submitted successfully.", "success");
            fetchData(); // Refresh data
        } catch (e) {
            showToast("Failed to submit vehicle check.", "error");
        } finally {
            setVehicleCheckModalOpen(false);
        }
    };

    const handleSaveKitCheck = async (checkData: Omit<KitCheck, 'id' | 'date'>) => {
        if (!selectedKitForCheck?.id || !user) return;
        try {
            await addKitCheck(selectedKitForCheck.id, checkData);
            showToast("Kit check submitted successfully.", "success");
            fetchData(); // Refresh data
        } catch (e) {
            showToast("Failed to submit kit check.", "error");
        } finally {
            setKitCheckModalOpen(false);
            setSelectedKitForCheck(null);
        }
    };

    const openKitCheckModal = (kit: Kit) => {
        setSelectedKitForCheck(kit);
        setKitCheckModalOpen(true);
    };
    
    if (loading) return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-12 h-12 text-ams-blue" /></div>;
    if (!shift) return <div className="text-center p-10">Shift not found.</div>;

    // FIX: Get user's role and colleagues from the shift's slots array.
    const mySlot = (shift?.slots || []).find(s => s.assignedStaff?.uid === user?.uid);
    const colleagues = (shift?.slots || [])
        .map(s => s.assignedStaff)
        .filter((s): s is { uid: string; name: string } => !!s && s.uid !== user?.uid) || [];

    return (
        <div>
            {isVehicleCheckModalOpen && vehicle && user && (
                <VehicleCheckModal 
                    isOpen={isVehicleCheckModalOpen}
                    onClose={() => setVehicleCheckModalOpen(false)}
                    onSave={handleSaveVehicleCheck}
                    vehicle={vehicle}
                    user={user}
                />
            )}
            {isKitCheckModalOpen && selectedKitForCheck && user && (
                 <KitCheckModal
                    isOpen={isKitCheckModalOpen}
                    onClose={() => { setKitCheckModalOpen(false); setSelectedKitForCheck(null); }}
                    onSave={handleSaveKitCheck}
                    kit={selectedKitForCheck}
                    user={user}
                    type="Sign Out"
                />
            )}
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">Event Briefing</h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">{shift.eventName}</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InfoCard title="Event Details" icon={<RotaIcon className="w-6 h-6" />}>
                    <p><strong>Date:</strong> {shift.start.toDate().toLocaleDateString()}</p>
                    <p><strong>Location:</strong> {shift.location}</p>
                </InfoCard>
                <InfoCard title="Your Shift" icon={<ClockIcon className="w-6 h-6" />}>
                    <p><strong>Role:</strong> {mySlot?.roleRequired}</p>
                    <p><strong>Time:</strong> {shift.start.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {shift.end.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    {shift.notes && <p><strong>Notes:</strong> {shift.notes}</p>}
                </InfoCard>
                <InfoCard title="Assigned Colleagues" icon={<PatientsIcon className="w-6 h-6" />}>
                    {colleagues.length > 0 ? (
                         <ul>{colleagues.map(s => <li key={s.uid}>{s.name}</li>)}</ul>
                    ) : (
                        <p>You are the only staff member assigned to this shift.</p>
                    )}
                </InfoCard>
                <InfoCard title="Assigned Vehicle" icon={<AmbulanceIcon className="w-6 h-6" />}>
                    {vehicle ? (
                        <div className="flex justify-between items-center">
                            <span>{vehicle.name} ({vehicle.registration})</span>
                            <button onClick={() => setVehicleCheckModalOpen(true)} className="px-3 py-1 bg-ams-light-blue text-white text-sm font-semibold rounded-md hover:bg-opacity-90">Start Check</button>
                        </div>
                    ) : (
                        <p>No vehicle assigned.</p>
                    )}
                </InfoCard>
                <InfoCard title="Assigned Kits" icon={<BoxIcon className="w-6 h-6" />} className="lg:col-span-2">
                    {kits.length > 0 ? (
                        <ul className="space-y-2">
                            {kits.map(k => {
                                const kitIsWithMe = k.status === 'With Crew' && k.assignedTo?.uid === user?.uid;
                                const kitIsWithOther = k.status === 'With Crew' && k.assignedTo?.uid !== user?.uid;
                                return (
                                <li key={k.id} className="flex justify-between items-center">
                                    <span>{k.name} ({k.type})</span>
                                    <div>
                                    {kitIsWithMe ? (
                                        <span className="px-3 py-1 text-sm font-semibold rounded-md bg-green-100 text-green-700 flex items-center gap-2">
                                            <CheckIcon className="w-4 h-4" /> Check Complete
                                        </span>
                                    ) : kitIsWithOther ? (
                                        <span className="px-3 py-1 text-sm font-semibold rounded-md bg-yellow-100 text-yellow-700">
                                            With: {k.assignedTo?.name}
                                        </span>
                                    ) : (
                                        <button onClick={() => openKitCheckModal(k)} className="px-3 py-1 bg-ams-light-blue text-white text-sm font-semibold rounded-md hover:bg-opacity-90">
                                            Start Check
                                        </button>
                                    )}
                                    </div>
                                </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p>No kits assigned to this shift.</p>
                    )}
                </InfoCard>
            </div>
        </div>
    );
};

export default EventBrief;