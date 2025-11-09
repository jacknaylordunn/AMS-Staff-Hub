import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getShiftById } from '../services/rotaService';
import { getEventById } from '../services/eventService';
import { getVehicleById } from '../services/assetService';
import { getKitById } from '../services/inventoryService';
import type { Shift, EventLog, Vehicle, Kit } from '../types';
// FIX: The 'Users' icon is not exported from 'components/icons'. Replaced with 'PatientsIcon' which uses the same underlying icon.
import { SpinnerIcon, RotaIcon, ClockIcon, PatientsIcon, AmbulanceIcon, BoxIcon } from '../components/icons';
import { showToast } from '../components/Toast';

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
    const [shift, setShift] = useState<Shift | null>(null);
    const [event, setEvent] = useState<EventLog | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [kits, setKits] = useState<Kit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shiftId) {
            setLoading(false);
            showToast("Shift ID not found.", "error");
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const shiftData = await getShiftById(shiftId);
                if (!shiftData) {
                    showToast("Shift not found.", "error");
                    setLoading(false);
                    return;
                }
                setShift(shiftData);

                const promises: Promise<any>[] = [getEventById(shiftData.eventId)];
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

                const [eventData, vehicleData, kitsData] = await Promise.all(promises);
                
                setEvent(eventData as EventLog | null);
                setVehicle(vehicleData as Vehicle | null);
                setKits((kitsData as (Kit | null)[]).filter(Boolean) as Kit[]);

            } catch (err) {
                console.error("Failed to fetch brief data:", err);
                showToast("Failed to load event brief.", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [shiftId]);
    
    if (loading) return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-12 h-12 text-ams-blue" /></div>;
    if (!shift) return <div className="text-center p-10">Shift not found.</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">Event Briefing</h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">{shift.eventName}</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InfoCard title="Event Details" icon={<RotaIcon className="w-6 h-6" />}>
                    <p><strong>Date:</strong> {event?.date}</p>
                    <p><strong>Location:</strong> {event?.location}</p>
                </InfoCard>
                <InfoCard title="Your Shift" icon={<ClockIcon className="w-6 h-6" />}>
                    <p><strong>Role:</strong> {shift.roleRequired}</p>
                    <p><strong>Time:</strong> {shift.start.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {shift.end.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    {shift.notes && <p><strong>Notes:</strong> {shift.notes}</p>}
                </InfoCard>
                <InfoCard title="Assigned Colleagues" icon={<PatientsIcon className="w-6 h-6" />}>
                    {shift.assignedStaff.length > 1 ? (
                         <ul>{shift.assignedStaff.map(s => <li key={s.uid}>{s.name}</li>)}</ul>
                    ) : (
                        <p>You are the only staff member assigned to this shift.</p>
                    )}
                </InfoCard>
                <InfoCard title="Assigned Vehicle" icon={<AmbulanceIcon className="w-6 h-6" />}>
                    {vehicle ? (
                        <p>{vehicle.name} ({vehicle.registration})</p>
                    ) : (
                        <p>No vehicle assigned.</p>
                    )}
                </InfoCard>
                <InfoCard title="Assigned Kits" icon={<BoxIcon className="w-6 h-6" />} className="lg:col-span-2">
                    {kits.length > 0 ? (
                        <ul className="list-disc list-inside">{kits.map(k => <li key={k.id}>{k.name} ({k.type})</li>)}</ul>
                    ) : (
                        <p>No kits assigned to this shift.</p>
                    )}
                </InfoCard>
            </div>
        </div>
    );
};

export default EventBrief;