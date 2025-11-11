
import React, { useMemo } from 'react';
import type { Shift } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { getStartOfMonth, addDays, areDatesTheSame } from '../../utils/dateHelpers';
import { isRoleOrHigher } from '../../utils/roleHelper';
import { ViewMode } from '../../pages/Rota';

interface MonthViewProps {
    currentDate: Date;
    shifts: Shift[];
    onOpenModal: (shift: Shift | null, date?: Date, type?: 'shift' | 'unavailability') => void;
    setViewMode: (mode: ViewMode) => void;
    setCurrentDate: (date: Date) => void;
}

const MonthView: React.FC<MonthViewProps> = ({ currentDate, shifts, onOpenModal, setViewMode, setCurrentDate }) => {
    const { user, isManager } = useAuth();
    
    const calendarGrid = useMemo(() => {
        const startOfMonth = getStartOfMonth(currentDate);
        const firstDayOfMonth = startOfMonth.getDay();
        const startDate = addDays(startOfMonth, -firstDayOfMonth);
        
        const days = [];
        for(let i = 0; i < 42; i++) {
            days.push(addDays(startDate, i));
        }
        return days;
    }, [currentDate]);

    const weeks = useMemo(() => {
        const weeksArray = [];
        for (let i = 0; i < calendarGrid.length; i += 7) {
            weeksArray.push(calendarGrid.slice(i, i + 7));
        }
        return weeksArray;
    }, [calendarGrid]);

    const shiftsByDay = useMemo(() => {
        const map = new Map<string, Shift[]>();
        calendarGrid.forEach(day => {
            const dayString = day.toISOString().split('T')[0];
            const dayShifts = shifts.filter(s => {
                const shiftStart = s.start.toDate();
                shiftStart.setHours(0,0,0,0);
                // In month view, only show the shift on its starting day for clarity. Multi-day bars are gone.
                return areDatesTheSame(day, shiftStart);
            }).sort((a, b) => a.start.toMillis() - b.start.toMillis());
            map.set(dayString, dayShifts);
        });
        return map;
    }, [shifts, calendarGrid]);

    const ShiftCard: React.FC<{ shift: Shift }> = ({ shift }) => {
        const isMyShift = (shift.allAssignedStaffUids || []).includes(user?.uid || '');
        const biddableSlots = (shift.slots || []).filter(s => !s.assignedStaff && isRoleOrHigher(user?.role, s.roleRequired)).length > 0;
        const isClickable = !shift.isUnavailability || isMyShift || isManager;
        
        let borderColor = 'border-gray-400';
        let bgColor = 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700';
        
        if (shift.isUnavailability) {
            borderColor = 'border-red-400';
            bgColor = 'bg-red-50 hover:bg-red-100 dark:bg-red-900/50 dark:hover:bg-red-900/80';
        } else if (isMyShift) {
            borderColor = 'border-ams-blue';
            bgColor = 'bg-blue-50 hover:bg-blue-100 dark:bg-ams-blue/20 dark:hover:bg-ams-blue/30';
        } else if (biddableSlots) {
            borderColor = 'border-green-400';
            bgColor = 'bg-green-50 hover:bg-green-100 dark:bg-green-900/50 dark:hover:bg-green-900/80';
        }

        const filledSlots = (shift.slots || []).filter(s => s.assignedStaff).length;
        const totalSlots = (shift.slots || []).length;

        return (
            <div 
                onClick={() => isClickable && onOpenModal(shift, undefined, shift.isUnavailability ? 'unavailability' : 'shift')}
                className={`p-1.5 rounded border-l-4 ${borderColor} ${bgColor} ${isClickable ? 'cursor-pointer' : ''} text-xs`}
            >
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{shift.start.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {!shift.isUnavailability && <span className="text-gray-500 dark:text-gray-400">{filledSlots}/{totalSlots} Filled</span>}
                </div>
                <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{shift.isUnavailability ? 'Unavailable' : shift.eventName}</p>
            </div>
        );
    };

    return (
        <div className="flex flex-col flex-grow">
            <div className="grid grid-cols-7 flex-shrink-0">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
                    <div key={dayName} className="text-center font-bold text-gray-600 dark:text-gray-300 py-2 text-sm">{dayName}</div>
                ))}
            </div>
            <div className="grid grid-rows-6 flex-grow border-t border-l border-gray-200 dark:border-gray-700">
                {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-7 relative border-b border-gray-200 dark:border-gray-700 min-h-[8rem] sm:min-h-[10rem]">
                        {week.map((day, dayIndex) => {
                            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                            const isToday = areDatesTheSame(new Date(), day);
                            const dayString = day.toISOString().split('T')[0];
                            const dayShifts = shiftsByDay.get(dayString) || [];
                            return (
                                <div key={dayIndex} className={`relative p-1 border-r border-gray-200 dark:border-gray-700 ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
                                    <div 
                                        className={`flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold cursor-pointer ${isToday ? 'bg-ams-light-blue text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} ${!isCurrentMonth ? 'text-gray-400' : 'dark:text-gray-200'}`}
                                        onClick={() => {setCurrentDate(day); setViewMode('day');}}
                                    >
                                        {day.getDate()}
                                    </div>
                                     <div className="absolute top-10 left-0 right-0 p-1 space-y-1 overflow-y-auto" style={{bottom: '4px'}}>
                                        {dayShifts.map(shift => (
                                            <ShiftCard key={shift.id} shift={shift} />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MonthView;
