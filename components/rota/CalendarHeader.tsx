import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { PlusIcon } from '../icons';
import { ViewMode } from '../../pages/Rota';
import { addDays, addMonths, addWeeks } from '../../utils/dateHelpers';

interface CalendarHeaderProps {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    currentDate: Date;
    // FIX: Changed the type of setCurrentDate to allow functional updates from useState.
    setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
    onAddUnavailability: () => void;
    onCreateShift: () => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    onAddUnavailability,
    onCreateShift
}) => {
    const { isManager } = useAuth();
    const { isOnline } = useOnlineStatus();
    
    const changeDate = (offset: number) => {
        switch (viewMode) {
            case 'month':
                setCurrentDate(prev => addMonths(prev, offset));
                break;
            case 'week':
                setCurrentDate(prev => addWeeks(prev, offset));
                break;
            case 'day':
                setCurrentDate(prev => addDays(prev, offset));
                break;
        }
    };

    const getHeaderText = () => {
        switch (viewMode) {
            case 'month':
                return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
            case 'week':
                const startOfWeek = new Date(currentDate);
                startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                return `${startOfWeek.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            case 'day':
                return currentDate.toLocaleString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
    };
    
    return (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 px-2">
            <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-md dark:border-gray-600">
                    <button onClick={() => changeDate(-1)} className="px-3 py-2 rounded-l-md hover:bg-gray-100 dark:hover:bg-gray-700">&lt;</button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 border-x dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-semibold">Today</button>
                    <button onClick={() => changeDate(1)} className="px-3 py-2 rounded-r-md hover:bg-gray-100 dark:hover:bg-gray-700">&gt;</button>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200 ml-4">
                    {getHeaderText()}
                </h2>
            </div>
            
             <div className="flex items-center gap-2 mt-4 sm:mt-0">
                <div className="p-1 bg-gray-200 dark:bg-gray-900 rounded-lg">
                    {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                        <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-sm font-semibold rounded-md capitalize ${viewMode === mode ? 'bg-white dark:bg-gray-700 shadow' : 'text-gray-600 dark:text-gray-400'}`}>
                            {mode}
                        </button>
                    ))}
                </div>
                 <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={onAddUnavailability} disabled={!isOnline} className="flex items-center justify-center px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 text-sm">
                        <PlusIcon className="w-4 h-4 mr-1" /> Unavailability
                    </button>
                    {isManager && (
                        <button onClick={onCreateShift} disabled={!isOnline} className="flex items-center justify-center px-3 py-2 bg-ams-light-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 text-sm">
                            <PlusIcon className="w-4 h-4 mr-1" /> New Shift
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CalendarHeader;