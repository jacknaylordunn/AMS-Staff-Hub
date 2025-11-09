

import React, { useState, useEffect, useMemo } from 'react';
import type { EventLog, Shift } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../services/eventService';
import { getShiftsForUser } from '../services/rotaService';
import { SpinnerIcon, CheckIcon, PlusIcon, TrashIcon, LogoutIcon } from '../components/icons';
import EventModal from '../components/EventModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { showToast } from '../components/Toast';

const getEventStatus = (eventDateStr: string): EventLog['status'] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = eventDateStr.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);

    if (eventDate.getTime() < today.getTime()) {
        return 'Completed';
    } else if (eventDate.getTime() === today.getTime()) {
        return 'Active';
    } else {
        return 'Upcoming';
    }
};


const DutyLogon: React.FC = () => {
    const { user, isManager } = useAuth();
    const { activeEvent, activeShift, setActiveEvent, setActiveShift, clearActiveSession } = useAppContext();
    const { isOnline } = useOnlineStatus();
    
    const [allEvents, setAllEvents] = useState<EventLog[]>([]);
    const [userShifts, setUserShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);
    const [eventToDelete, setEventToDelete] = useState<EventLog | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const today = new Date();
            const [eventList, shiftList] = await Promise.all([
                getEvents(),
                getShiftsForUser(user.uid, today.getFullYear(), today.getMonth())
            ]);
            const eventsWithStatus = eventList.map(e => ({ ...e, status: getEventStatus(e.date) }));
            setAllEvents(eventsWithStatus);
            setUserShifts(shiftList.filter(s => !s.isUnavailability));
        } catch (error) {
            if (isOnline) {
                showToast("Failed to fetch duty information.", "error");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isOnline, user]);

    const { currentShifts, upcomingShifts } = useMemo(() => {
        const now = new Date();
        const currentShifts = userShifts.filter(s => s.start.toDate() <= now && s.end.toDate() >= now);
        const upcomingShifts = userShifts.filter(s => s.start.toDate() > now).sort((a,b) => a.start.toMillis() - b.start.toMillis());
        return { currentShifts, upcomingShifts };
    }, [userShifts]);
    
    const handleLogon = (logonItem: Shift | EventLog) => {
        if ('eventId' in logonItem) { // It's a Shift
            setActiveShift(logonItem);
        } else { // It's an EventLog
            setActiveEvent(logonItem);
        }
    };
    
    // Modal handling logic
    const handleOpenEditModal = (event: EventLog | null) => { setSelectedEvent(event); setEditModalOpen(true); };
    const handleOpenDeleteModal = (event: EventLog) => { setEventToDelete(event); setDeleteModalOpen(true); }
    const handleSaveEvent = async (eventData: Omit<EventLog, 'id' | 'status'>) => {
        try {
            if (selectedEvent) {
                await updateEvent(selectedEvent.id!, eventData);
                showToast("Event updated successfully.", "success");
            } else {
                await createEvent(eventData);
                showToast("Event created successfully.", "success");
            }
            fetchData();
        } catch (e) { showToast("Failed to save event.", "error"); }
        finally { setEditModalOpen(false); setSelectedEvent(null); }
    };
    const handleDeleteConfirm = async () => {
        if (!eventToDelete) return;
        setIsDeleting(true);
        try {
            await deleteEvent(eventToDelete.id!);
            showToast("Event deleted successfully.", "success");
            setAllEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
        } catch(e) { showToast("Failed to delete event.", "error"); }
        finally { setIsDeleting(false); setDeleteModalOpen(false); setEventToDelete(null); }
    }

    const DutyCard: React.FC<{item: Shift, onLogon: () => void, onLogoff: () => void, isActive: boolean}> = ({item, onLogon, onLogoff, isActive}) => {
        const title = item.eventName;
        const startTime = item.start.toDate();
        
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col justify-between border-l-4 border-ams-blue dark:border-ams-light-blue">
                <div>
                    <h3 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">{title}</h3>
                    <p className="text-gray-700 dark:text-gray-300 font-semibold">{item.roleRequired}</p>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {startTime.toLocaleDateString()} @ {startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {item.end.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                </div>
                 <button 
                    onClick={isActive ? onLogoff : onLogon}
                    className={`w-full mt-4 px-4 py-2 font-semibold text-white rounded-md flex items-center justify-center transition-colors ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-ams-light-blue hover:bg-opacity-90'}`}
                >
                    {isActive ? <><LogoutIcon className="w-5 h-5 mr-2"/> Log Off</> : 'Logon'}
                 </button>
            </div>
        )
    };

    return (
        <div>
            {isManager && <EventModal isOpen={isEditModalOpen} onClose={() => { setEditModalOpen(false); setSelectedEvent(null); }} onSave={handleSaveEvent} event={selectedEvent} />}
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Delete Event" message={`Are you sure you want to delete "${eventToDelete?.name}"?`} confirmText="Delete" isLoading={isDeleting}/>
            
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                 <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Duty Logon</h1>
                 {isManager && (
                    <button onClick={() => handleOpenEditModal(null)} disabled={!isOnline} className="flex items-center px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400">
                        <PlusIcon className="w-5 h-5 mr-2" /> Create Event
                    </button>
                )}
            </div>
            
            {!isOnline && (
                <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md dark:bg-yellow-900 dark:text-yellow-200">
                    <p><span className="font-bold">Offline Mode:</span> Logon functionality is disabled. Viewing cached duty information.</p>
                </div>
            )}
            
            {loading ? (
                <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" /></div>
            ) : (
                <div className="space-y-8">
                    {/* Current Shifts */}
                    {currentShifts.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b pb-2">Your Current Shift</h2>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {currentShifts.map(shift => <DutyCard key={shift.id} item={shift} onLogon={() => handleLogon(shift)} onLogoff={clearActiveSession} isActive={activeShift?.id === shift.id}/>)}
                             </div>
                        </div>
                    )}

                     {/* Upcoming Shifts */}
                    {upcomingShifts.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b pb-2">Your Upcoming Shifts</h2>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {upcomingShifts.map(shift => <DutyCard key={shift.id} item={shift} onLogon={() => handleLogon(shift)} onLogoff={clearActiveSession} isActive={activeShift?.id === shift.id}/>)}
                             </div>
                        </div>
                    )}

                    {currentShifts.length === 0 && upcomingShifts.length === 0 && (
                         <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                            You have no current or upcoming shifts.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DutyLogon;