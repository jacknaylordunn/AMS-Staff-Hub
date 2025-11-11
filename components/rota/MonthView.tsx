
import React, { useMemo } from 'react';
import type { Shift, User } from '../../types';
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

interface ProcessedShift {
    shift: Shift;
    startDay: number; // 0-6 (Sun-Sat)
    span: number; // 1-7
    row: number;
}

const processShiftsForLayout = (shifts: Shift[], weekStart: Date, weekEnd: Date): ProcessedShift[] => {
    const weekShifts = shifts.filter(s => {
        const shiftStart = s.start.toDate();
        const shiftEnd = s.end.toDate();
        return shiftStart <= weekEnd && shiftEnd >= weekStart;
    }).sort((a,b) => a.start.toMillis() - b.start.toMillis());

    const layoutRows: Date[][] = []; // Stores the end dates of shifts in each row
    const processed: ProcessedShift[] = [];

    for (const shift of weekShifts) {
        const shiftStart = shift.start.toDate();
        const shiftEnd = shift.end.toDate();
        
        let startDay = shiftStart < weekStart ? 0 : shiftStart.getDay();
        const endDay = shiftEnd > weekEnd ? 6 : shiftEnd.getDay();

        let span = endDay - startDay + 1;

        let foundRow = false;
        for(let i = 0; i < layoutRows.length; i++) {
            const lastShiftEndInRow = layoutRows[i][layoutRows[i].length - 1];
            if (!lastShiftEndInRow || shiftStart > lastShiftEndInRow) {
                processed.push({ shift, startDay, span, row: i });
                layoutRows[i].push(shiftEnd);
                foundRow = true;
                break;
            }
        }
        
        if (!foundRow) {
            processed.push({ shift, startDay, span, row: layoutRows.length });
            layoutRows.push([shiftEnd]);
        }
    }
    return processed;
};


const MonthView: React.FC<MonthViewProps> = ({ currentDate, shifts, onOpenModal, setViewMode, setCurrentDate }) => {
    const { user } = useAuth();
    
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

    const ShiftItem: React.FC<{ processed: ProcessedShift, weekStart: Date, weekEnd: Date }> = ({ processed, weekStart, weekEnd }) => {
        const { shift, startDay, span, row } = processed;
        
        const isMyShift = user ? (shift.allAssignedStaffUids || []).includes(user.uid) : false;
        const biddableSlots = (shift.slots || []).filter(s => !s.assignedStaff && isRoleOrHigher(user?.role, s.roleRequired)).length > 0;

        let styleClasses = 'bg-gradient-to-r from-gray-500 to-gray-600 border-l-4 border-gray-300';
        if (shift.isUnavailability) styleClasses = 'bg-gradient-to-r from-red-500 to-red-600 border-l-4 border-red-300';
        else if (isMyShift) styleClasses = 'bg-gradient-to-r from-ams-blue to-blue-800 border-l-4 border-ams-light-blue';
        else if (biddableSlots) styleClasses = 'bg-gradient-to-r from-green-500 to-green-600 border-l-4 border-green-300';
        else if (shift.status === 'Open') styleClasses = 'bg-gradient-to-r from-yellow-500 to-yellow-600 border-l-4 border-yellow-300';
        else if (shift.status === 'Partially Assigned') styleClasses = 'bg-gradient-to-r from-orange-500 to-orange-600 border-l-4 border-orange-300';
        
        const startsBeforeWeek = shift.start.toDate() < weekStart;
        const endsAfterWeek = shift.end.toDate() > weekEnd;

        const style = {
            gridColumnStart: startDay + 1,
            gridColumnEnd: startDay + span + 1,
            top: `${2 + row * 1.75}rem`,
        };
        
        const roundingClasses = `${startsBeforeWeek ? 'rounded-l-none' : ''} ${endsAfterWeek ? 'rounded-r-none' : ''}`;
        const isClickable = !shift.isUnavailability || isMyShift || user?.role === 'Manager' || user?.role === 'Admin';
        
        const filledSlots = (shift.slots || []).filter(s => s.assignedStaff).length;
        const totalSlots = (shift.slots || []).length;
        const tooltip = shift.isUnavailability 
            ? 'Unavailable' 
            : `${shift.eventName}\n${shift.start.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${shift.end.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\nStatus: ${filledSlots}/${totalSlots} Filled`;

        return (
            <div
                style={style}
                onClick={() => isClickable && onOpenModal(shift, undefined, shift.isUnavailability ? 'unavailability' : 'shift')}
                title={tooltip}
                className={`absolute left-0 right-0 mx-1 p-1 text-white text-xs rounded-md ${styleClasses} ${roundingClasses} ${isClickable ? 'cursor-pointer' : 'cursor-default'} overflow-hidden truncate`}
            >
                <span className="font-semibold">{shift.isUnavailability ? (isMyShift || user?.role === 'Manager' ? 'Unavailable' : 'Booked Off') : shift.eventName}</span>
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
                {weeks.map((week, weekIndex) => {
                    const weekStart = week[0];
                    const weekEnd = week[6];
                    const processedShifts = processShiftsForLayout(shifts, weekStart, weekEnd);

                    return (
                        <div key={weekIndex} className="grid grid-cols-7 relative border-b border-gray-200 dark:border-gray-700 min-h-[6rem] sm:min-h-[8rem]">
                            {week.map((day, dayIndex) => {
                                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                                const isToday = areDatesTheSame(new Date(), day);
                                return (
                                    <div key={dayIndex} className={`relative p-2 border-r border-gray-200 dark:border-gray-700 ${!isCurrentMonth && 'bg-gray-50 dark:bg-gray-800/50'}`}>
                                        <div 
                                            className={`flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold cursor-pointer ${isToday ? 'bg-ams-light-blue text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} ${!isCurrentMonth ? 'text-gray-400' : 'dark:text-gray-200'}`}
                                            onClick={() => {setCurrentDate(day); setViewMode('day');}}
                                        >
                                            {day.getDate()}
                                        </div>
                                    </div>
                                )
                            })}
                            {processedShifts.map(p => <ShiftItem key={p.shift.id} processed={p} weekStart={weekStart} weekEnd={weekEnd}/>)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthView;
