import React, { useState, useEffect, useMemo } from 'react';
import type { Shift, EventLog, User as AppUser } from '../types';
import { getShiftsForMonth, getEvents, getUsers, createShift, updateShift, deleteShift, getShiftsForUser } from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import { SpinnerIcon, PlusIcon } from '../components/icons';
import ShiftModal from '../components/ShiftModal';

const Rota: React.FC = () => {
    const { user, isManager } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [modalDate, setModalDate] = useState<Date | null>(null);

    // For manager modals
    const [events, setEvents] = useState<EventLog[]>([]);
    const [staff, setStaff] = useState<AppUser[]>([]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const fetchData = async () => {
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
                const shiftsData = await getShiftsForUser(user.uid, year, month);
                setShifts(shiftsData);
            }
            setLoading(false);
        };
        fetchData();
    }, [currentDate, user, isManager]);

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

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    }

    const handleOpenModal = (shift: Shift | null, date?: Date) => {
        setSelectedShift(shift);
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
            await updateShift(selectedShift.id, shiftData);
        } else {
            await createShift(shiftData);
        }
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const updatedShifts = isManager ? await getShiftsForMonth(year, month) : await getShiftsForUser(user!.uid, year, month);
        setShifts(updatedShifts);
        setLoading(false);
        handleCloseModal();
    };

    const handleDeleteShift = async (shiftId: string) => {
        setLoading(true);
        await deleteShift(shiftId);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const updatedShifts = isManager ? await getShiftsForMonth(year, month) : await getShiftsForUser(user!.uid, year, month);
        setShifts(updatedShifts);
        setLoading(false);
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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            {isManager && isModalOpen && (
                <ShiftModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveShift}
                    onDelete={handleDeleteShift}
                    shift={selectedShift}
                    date={modalDate}
                    events={events}
                    staff={staff}
                />
            )}
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-ams-blue text-white rounded">&lt; Prev</button>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                </h2>
                <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-ams-blue text-white rounded">Next &gt;</button>
            </div>
             {isManager && (
                <div className="flex justify-end mb-4">
                    <button onClick={() => handleOpenModal(null, new Date())} className="flex items-center px-4 py-2 bg-ams-light-blue text-white rounded-md hover:bg-opacity-90">
                        <PlusIcon className="w-5 h-5 mr-2" /> Create Shift
                    </button>
                </div>
            )}
            
            {loading ? (
                <div className="flex justify-center items-center h-96"><SpinnerIcon className="w-10 h-10 text-ams-blue" /></div>
            ) : (
                <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
                        <div key={dayName} className="text-center font-bold bg-gray-100 dark:bg-gray-900 dark:text-gray-300 py-2">{dayName}</div>
                    ))}

                    {calendarGrid.map((d, i) => {
                        const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                        const isToday = new Date().toDateString() === d.toDateString();
                        const dayShifts = shiftsForDay(d);
                        
                        return (
                            <div key={i} className={`p-2 min-h-36 bg-white dark:bg-gray-800 ${!isCurrentMonth && 'bg-gray-50 dark:bg-gray-800/50'}`}>
                                <div className="flex justify-between items-center">
                                    <span className={`flex justify-center items-center h-8 w-8 rounded-full text-sm ${isToday ? 'bg-ams-light-blue text-white' : ''} ${!isCurrentMonth ? 'text-gray-400' : 'dark:text-gray-200'}`}>
                                        {d.getDate()}
                                    </span>
                                    {isManager && isCurrentMonth && (
                                        <button onClick={() => handleOpenModal(null, d)} className="text-ams-light-blue hover:text-ams-blue">
                                            <PlusIcon className="w-5 h-5"/>
                                        </button>
                                    )}
                                </div>
                                <div className="mt-1 space-y-1 overflow-y-auto max-h-24">
                                    {dayShifts.map(shift => (
                                        <div key={shift.id} onClick={() => isManager && handleOpenModal(shift)} className={`p-1.5 rounded text-white text-xs ${isManager ? 'cursor-pointer' : ''} bg-ams-blue`}>
                                            <p className="font-semibold truncate">{shift.eventName}</p>
                                            <p className="truncate">{shift.start.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            {isManager && <p className="text-xs truncate text-gray-300">{shift.assignedStaff.length} crew</p>}
                                             {!isManager && <p className="text-xs truncate text-gray-300">{shift.roleRequired}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Rota;