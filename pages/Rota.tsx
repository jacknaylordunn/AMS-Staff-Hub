import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Shift, ShiftSlot, User as AppUser, Vehicle, Kit } from '../types';
import { listenToShiftsForMonth, createShift, updateShift, deleteShift } from '../services/rotaService';
import { getUsers } from '../services/userService';
import { listenToVehicles } from '../services/assetService';
import { listenToKits } from '../services/inventoryService';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SpinnerIcon, PlusIcon, RefreshIcon } from '../components/icons';
import ShiftModal from '../components/ShiftModal';
import { isRoleOrHigher } from '../utils/roleHelper';
import { showToast } from '../components/Toast';

const Rota: React.FC = () => {
    const { user, isManager } = useAuth();
    const { isOnline } = useOnlineStatus();
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [modalDate, setModalDate] = useState<Date | null>(null);
    const [modalType, setModalType] = useState<'shift' | 'unavailability'>('shift');
    const [manualRefresh, setManualRefresh] = useState(0);

    // For manager modals
    const [staff, setStaff] = useState<AppUser[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [kits, setKits] = useState<Kit[]>([]);

    useEffect(() => {
        if (!isManager) return;

        const unsubVehicles = listenToVehicles(setVehicles);
        const unsubKits = listenToKits(setKits);

        const fetchSupportData = async () => {
            try {
                const staffData = await getUsers();
                setStaff(staffData);
            } catch (error) {
                 if (isOnline) {
                    console.error("Failed to fetch rota support data:", error);
                    showToast("Failed to fetch staff.", "error");
                }
            }
        };

        fetchSupportData();
        
        return () => {
            unsubVehicles();
            unsubKits();
        };

    }, [isManager, isOnline]);
    
    useEffect(() => {
        if (!user) return;
        
        setLoading(true);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const unsubscribe = listenToShiftsForMonth(year, month, (shiftsData) => {
            setShifts(shiftsData);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [currentDate, user, manualRefresh]);


    const calendarGrid = useMemo(() => {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const startDate = new Date(startOfMonth);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        const days = [];
        let day = new Date(startDate);
        while (days.length < 42) {
            days.push(new Date(day));
            day.setDate(day.getDate() + 1);
        }
        return days;
    }, [currentDate]);
    
    const sortedShiftsForMonth = useMemo(() => {
        if (!user) return [];
        return shifts
            .filter(s => !s.isUnavailability && (s.allAssignedStaffUids || []).includes(user.uid))
            .sort((a,b) => (a.start?.toMillis() || 0) - (b.start?.toMillis() || 0));
    }, [shifts, user]);

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
        if (selectedShift?.id) {
            await updateShift(selectedShift.id, shiftData);
        } else {
            await createShift(shiftData);
        }
    };

    const handleDeleteShift = async (shiftId: string) => {
        await deleteShift(shiftId);
        handleCloseModal();
    }

    const shiftsForDay = (date: Date) => {
        return shifts.filter(shift => {
            const shiftDate = shift.start?.toDate();
            if (!shiftDate) return false;
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
                    staff={staff}
                    vehicles={vehicles}
                    kits={kits}
                    type={modalType}
                    currentUser={user!}
                    refreshShifts={async () => setManualRefresh(c => c + 1)}
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
                 <button onClick={() => setManualRefresh(c => c + 1)} className="flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">
                    <RefreshIcon className="w-5 h-5 mr-2" /> Refresh Data
                </button>
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
                 <div className="md:hidden space-y-4">
                    {sortedShiftsForMonth.length > 0 ? sortedShiftsForMonth.map(shift => {
                        const mySlot = (shift.slots || []).find(s => s.assignedStaff?.uid === user!.uid);
                        const colleagues = (shift.slots || [])
                            .filter(s => s.assignedStaff && s.assignedStaff.uid !== user!.uid)
                            .map(s => s.assignedStaff!.name)
                            .join(', ');

                        return (
                         <div key={shift.id} onClick={() => navigate(`/brief/${shift.id}`)} className="p-4 rounded-lg shadow text-white cursor-pointer bg-ams-blue">
                             <div className="font-bold text-lg">{shift.eventName}</div>
                             <div className="text-gray-200">{shift.start?.toDate().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                             <div className="mt-2">{shift.start?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                             {mySlot && <div className="text-sm mt-1 text-ams-light-blue font-semibold">{mySlot.roleRequired}</div>}
                             {colleagues && (
                                <div className="text-sm mt-2 pt-2 border-t border-white/20">
                                    <span className="text-gray-300">Working with:</span> {colleagues}
                                </div>
                             )}
                         </div>
                    )}) : (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">No shifts scheduled for this month.</p>
                    )}
                 </div>

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
                                    {dayShifts.map(shift => {
                                        const isMyShift = user ? (shift.allAssignedStaffUids || []).includes(user.uid) : false;
                                        const safeSlots = shift.slots || [];
                                        const biddableSlots = safeSlots.filter(s => !s.assignedStaff && isRoleOrHigher(user?.role, s.roleRequired)).length;
                                        const filledSlots = safeSlots.filter(s => s.assignedStaff).length;
                                        const totalSlots = safeSlots.length;
                                        const status = shift.status || 'Open';

                                        let bgColor = 'bg-gray-400 dark:bg-gray-600';
                                        if (shift.isUnavailability) bgColor = 'bg-red-400 dark:bg-red-700';
                                        else if (isMyShift) bgColor = 'bg-ams-blue';
                                        else if (biddableSlots > 0 && !isManager) bgColor = 'bg-green-500';
                                        else if (status === 'Open' && isManager) bgColor = 'bg-yellow-500';
                                        else if (status === 'Partially Assigned' && isManager) bgColor = 'bg-orange-500';
                                        
                                        const isClickable = isOnline && (isManager || isMyShift || biddableSlots > 0);

                                        return (
                                        <div key={shift.id} onClick={() => isClickable && handleOpenModal(shift, undefined, shift.isUnavailability ? 'unavailability' : 'shift')} 
                                            className={`p-1.5 rounded text-white text-xs ${isClickable ? 'cursor-pointer' : 'cursor-default'} ${bgColor}`}>
                                            
                                            {shift.isUnavailability ? (
                                                <p className="font-semibold truncate">{isManager || isMyShift ? 'Unavailable' : 'Booked Off'}</p>
                                            ) : (
                                                <>
                                                    <p className="font-semibold truncate">{shift.eventName}</p>
                                                    <p className="truncate">{shift.start?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                    <p className="text-xs truncate text-gray-200 dark:text-gray-300 font-bold">{filledSlots}/{totalSlots} Filled</p>
                                                </>
                                            )}
                                        </div>
                                    )})}
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