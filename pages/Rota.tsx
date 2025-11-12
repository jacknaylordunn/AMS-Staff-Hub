
import React, { useState, useEffect, useMemo } from 'react';
import type { Shift, User as AppUser, Vehicle, Kit } from '../types';
import { listenToShiftsForRange, createShift, updateShift, deleteShift } from '../services/rotaService';
import { getUsers } from '../services/userService';
import { listenToVehicles } from '../services/assetService';
import { listenToKits } from '../services/inventoryService';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SpinnerIcon } from '../components/icons';
import ShiftModal from '../components/ShiftModal';
import { showToast } from '../components/Toast';
import { getStartOfMonth, addMonths } from '../utils/dateHelpers';
import CalendarHeader from '../components/rota/CalendarHeader';
import MonthView from '../components/rota/MonthView';
import WeekView from '../components/rota/WeekView';
import DayView from '../components/rota/DayView';

export type ViewMode = 'month' | 'week' | 'day';

const Rota: React.FC = () => {
    const { user, isManager } = useAuth();
    const { isOnline } = useOnlineStatus();
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [modalDate, setModalDate] = useState<Date | null>(null);
    const [modalType, setModalType] = useState<'shift' | 'unavailability'>('shift');
    
    // For manager modals
    const [staff, setStaff] = useState<AppUser[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [kits, setKits] = useState<Kit[]>([]);

    const fetchRange = useMemo(() => {
        const date = getStartOfMonth(currentDate);
        const startDate = addMonths(date, -1);
        const endDate = addMonths(date, 2);
        endDate.setDate(endDate.getDate() - 1);
        return { startDate, endDate };
    }, [currentDate]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubscribe = listenToShiftsForRange(fetchRange.startDate, fetchRange.endDate, (shiftsData) => {
            setShifts(shiftsData);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [user, fetchRange]);

    useEffect(() => {
        if (!isManager) return;

        const unsubVehicles = listenToVehicles(setVehicles);
        const unsubKits = listenToKits(setKits);

        getUsers().then(setStaff).catch(() => {
             if (isOnline) showToast("Failed to fetch staff list.", "error");
        });
        
        return () => {
            unsubVehicles();
            unsubKits();
        };
    }, [isManager, isOnline]);
    
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
        // Listener will update the UI automatically
        handleCloseModal();
    };

    const handleDeleteShift = async (shiftId: string) => {
        await deleteShift(shiftId);
        handleCloseModal();
    };

    const renderView = () => {
        switch(viewMode) {
            case 'week':
                return <WeekView currentDate={currentDate} shifts={shifts} onOpenModal={handleOpenModal} />;
            case 'day':
                return <DayView currentDate={currentDate} shifts={shifts} onOpenModal={handleOpenModal} />;
            case 'month':
            default:
                return <MonthView currentDate={currentDate} shifts={shifts} onOpenModal={handleOpenModal} setViewMode={setViewMode} setCurrentDate={setCurrentDate} />;
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-2 sm:p-4 rounded-lg shadow h-full flex flex-col">
            {isModalOpen && user && (
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
                    currentUser={user}
                    allShifts={shifts}
                />
            )}
            <CalendarHeader
                viewMode={viewMode}
                setViewMode={setViewMode}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                onAddUnavailability={() => handleOpenModal(null, new Date(), 'unavailability')}
                onCreateShift={() => handleOpenModal(null, new Date(), 'shift')}
            />
            {loading ? (
                <div className="flex-grow flex justify-center items-center h-96"><SpinnerIcon className="w-10 h-10 text-ams-blue" /></div>
            ) : (
                <div className="flex-grow">
                    {renderView()}
                </div>
            )}
        </div>
    );
};

export default Rota;