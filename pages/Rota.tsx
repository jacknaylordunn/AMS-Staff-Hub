import React, { useState, useEffect, useMemo } from 'react';
import type { Shift, EventLog, User as AppUser } from '../types';
import { getShiftsForMonth, createShift, updateShift, deleteShift, getShiftsForUser } from '../services/rotaService';
import { getEvents } from '../services/eventService';
import { getUsers } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SpinnerIcon, PlusIcon } from '../components/icons';
import ShiftModal from '../components/ShiftModal';

const Rota: React.FC = () => {
    const { user, isManager } = useAuth();
    const { isOnline } = useOnlineStatus();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [modalDate, setModalDate] = useState<Date | null>(null);
    const [modalType, setModalType] = useState<'shift' | 'unavailability'>('shift');

    // For manager modals
    const [events, setEvents] = useState<EventLog[]>([]);
    const [staff, setStaff] = useState<AppUser[]>([]);

    const fetchRotaData = async () => {
        if (!user) return;
        setLoading(true);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        try {
            if (isManager) {
                const [shiftsData, eventsData, staffData] = await Promise.all([
                    getShiftsForMonth(year, month),
                    getEvents(),
                    getUsers()
                ]);
                setShifts(shiftsData);
                setEvents(eventsData);
                setStaff(staffData);
            } else {
                // Fetch both user's shifts and their unavailability
                const shiftsData = await getShiftsForUser(user.uid, year, month);
                setShifts(shiftsData);
            }
        } catch (error) {
             if (isOnline) {
                console.error("Failed to fetch rota data:", error);
             }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRotaData();
    }, [currentDate, user, isManager, isOnline]);

    const calendarGrid = useMemo(() => {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const startDate = new Date(startOfMonth);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        const days = [];
        let day = new Date(startDate);
        while (days.length < 42) { // Always render 6 weeks for consistent grid size
            days.push(new Date(day));
            day.setDate(day.getDate() + 1);
        }
        return days;
    }, [currentDate]);
    
    const sortedShiftsForMonth = useMemo(() => {
        return shifts.filter(s => !s.isUnavailability).sort((a,b) => a.start.toMillis() - b.start.toMillis());
    }, [shifts]);

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    }

    const handleOpenModal = (shift: Shift | null, date?: Date, type: 'shift' | 'unavailability' = 'shift') => {
        setSelectedShift(shift);
        setModalType(type);
        if (date) setModalDate(date);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedShift(null);
        setModalDate(null);
    };

    const handleSaveShift = async (shiftData: Omit<Shift, 'id'>) => {
        setLoading(true);
        if (selectedShift?.id) {
            const originalAssignedUids = selectedShift.assignedStaff.map(s => s.uid);
            await updateShift(selectedShift.id, shiftData, originalAssignedUids);
        } else {
            await createShift(shiftData);
        }
        fetchRotaData();
        handleCloseModal();
    };

    const handleDeleteShift = async (shiftId: string) => {
        setLoading(true);
        await deleteShift(shiftId);
        fetchRotaData();
        handleCloseModal();
    }

    const shiftsForDay = (date: Date) => {
        return shifts.filter(shift => {
            const shiftDate = shift.start.toDate();
            return shiftDate.getFullYear() === date.getFullYear() &&
                   shiftDate.getMonth() === date.getMonth() &&
                   shiftDate.getDate() === date.getDate();
        });
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
            {isModalOpen && (
                <ShiftModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveShift}
                    onDelete={handleDeleteShift}
                    shift={selectedShift}
                    date={modalDate}
                    events={events}
                    staff={staff}
                    type={modalType}
                    currentUser={user!}
                />
            )}
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-ams-blue text-white rounded">&lt; Prev</button>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200 text-center">
                    {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                </h2>
                <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-ams-blue text-white rounded">Next &gt;</button>
            </div>
             <div className="flex flex-col sm:flex-row justify-end mb-4 gap-2">
                <button onClick={() => handleOpenModal(null, new Date(), 'unavailability')} disabled={!isOnline} className="flex items-center justify-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400">
                    <PlusIcon className="w-5 h-5 mr-2" /> Add Unavailability
                </button>
                {isManager && (
                    <button onClick={() => handleOpenModal(null, new Date())} disabled={!isOnline} className="flex items-center justify-center px-4 py-2 bg-ams-light-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400">
                        <PlusIcon className="w-5 h-5 mr-2" /> Create Shift
                    </button>
                )}
            </div>
            
             {!isOnline && (
                <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md dark:bg-yellow-900 dark:text-yellow-200">
                    <p><span className="font-bold">Offline Mode:</span> You are viewing a cached rota. Please reconnect to make changes or see live updates.</p>
                </div>
            )}
            
            {loading ? (
                <div className="flex justify-center items-center h-96"><SpinnerIcon className="w-10 h-10 text-ams-blue" /></div>
            ) : (
                <>
                 {/* Mobile List View */}
                 <div className="md:hidden space-y-4">
                    {sortedShiftsForMonth.length > 0 ? sortedShiftsForMonth.map(shift => {
                        const colleagues = shift.assignedStaff.filter(s => s.uid !== user!.uid).map(s => s.name).join(', ');
                        const assignedNames = shift.assignedStaff.map(s => s.name.split(' ')[0]).join(', ');
                        return (
                         <div key={shift.id} onClick={() => isManager && isOnline && handleOpenModal(shift)} className={`p-4 rounded-lg shadow text-white ${isManager && isOnline ? 'cursor-pointer' : ''} bg-ams-blue`}>
                             <div className="font-bold text-lg">{shift.eventName}</div>
                             <div className="text-gray-200">{shift.start.toDate().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                             <div className="mt-2">{shift.start.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                              <div className="text-sm mt-1 text-ams-light-blue font-semibold">{shift.roleRequired}</div>
                             {!isManager && shift.assignedStaff.length > 1 && (
                                <div className="text-sm mt-2 pt-2 border-t border-white/20">
                                    <span className="text-gray-300">Working with:</span> {colleagues || 'N/A'}
                                </div>
                             )}
                             {isManager && <div className="text-xs mt-1 text-gray-300 truncate" title={`Crew: ${shift.assignedStaff.map(s => s.name).join(', ')}`}>Crew: {assignedNames || 'Unassigned'}</div>}
                         </div>
                    )}) : (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">No shifts scheduled for this month.</p>
                    )}
                 </div>

                {/* Desktop Grid View */}
                <div className="hidden md:grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
                        <div key={dayName} className="text-center font-bold bg-gray-100 dark:bg-gray-900 dark:text-gray-300 py-2">{dayName}</div>
                    ))}

                    {calendarGrid.map((d, i) => {
                        const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                        const isToday = new Date().toDateString() === d.toDateString();
                        const dayShifts = shiftsForDay(d);
                        
                        return (
                            <div key={i} className={`relative p-2 min-h-36 bg-white dark:bg-gray-800 ${!isCurrentMonth && 'bg-gray-50 dark:bg-gray-800/50'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`flex justify-center items-center h-8 w-8 rounded-full text-sm ${isToday ? 'bg-ams-light-blue text-white' : ''} ${!isCurrentMonth ? 'text-gray-400' : 'dark:text-gray-200'}`}>
                                        {d.getDate()}
                                    </span>
                                    {isManager && isCurrentMonth && isOnline && (
                                        <button onClick={() => handleOpenModal(null, d)} className="text-ams-light-blue hover:text-ams-blue opacity-0 hover:opacity-100 transition-opacity">
                                            <PlusIcon className="w-5 h-5"/>
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1 overflow-y-auto max-h-28">
                                    {dayShifts.map(shift => (
                                        <div key={shift.id} onClick={() => (isManager || shift.assignedStaffUids.includes(user!.uid)) && isOnline && handleOpenModal(shift, undefined, shift.isUnavailability ? 'unavailability' : 'shift')} 
                                            className={`p-1.5 rounded text-white text-xs ${isOnline && (isManager || shift.assignedStaffUids.includes(user!.uid)) ? 'cursor-pointer' : 'cursor-default'} ${shift.isUnavailability ? 'bg-red-500' : 'bg-ams-blue'}`}>
                                            
                                            {shift.isUnavailability ? (
                                                <p className="font-semibold truncate">Unavailable</p>
                                            ) : (
                                                <>
                                                    <p className="font-semibold truncate">{shift.eventName}</p>
                                                    <p className="truncate">{shift.start.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                    {isManager ? (
                                                        <p className="text-xs truncate text-gray-300">
                                                            {shift.assignedStaff.map(s => s.name.split(' ')[0]).join(', ') || 'Unassigned'}
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs truncate text-gray-300">{shift.roleRequired}</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                </>
            )}
        </div>
    );
};

export default Rota;
