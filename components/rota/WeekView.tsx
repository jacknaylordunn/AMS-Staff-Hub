
import React, { useMemo } from 'react';
import type { Shift } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { getStartOfWeek, addDays, areDatesTheSame } from '../../utils/dateHelpers';
import { isRoleOrHigher } from '../../utils/roleHelper';

interface WeekViewProps {
    currentDate: Date;
    shifts: Shift[];
    onOpenModal: (shift: Shift | null, date?: Date, type?: 'shift' | 'unavailability') => void;
}

const WeekView: React.FC<WeekViewProps> = ({ currentDate, shifts, onOpenModal }) => {
    const weekDays = useMemo(() => {
        const start = getStartOfWeek(currentDate);
        return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }, [currentDate]);

    const shiftsByDay = useMemo(() => {
        const map = new Map<string, Shift[]>();
        weekDays.forEach(day => {
            const dayString = day.toISOString().split('T')[0];
            const dayShifts = shifts.filter(s => {
                const shiftStart = s.start.toDate();
                const shiftEnd = s.end.toDate();
                const dayStart = new Date(day);
                dayStart.setHours(0,0,0,0);
                const dayEnd = new Date(day);
                dayEnd.setHours(23,59,59,999);
                return shiftStart <= dayEnd && shiftEnd >= dayStart;
            }).sort((a, b) => a.start.toMillis() - b.start.toMillis());
            map.set(dayString, dayShifts);
        });
        return map;
    }, [shifts, weekDays]);

    const ShiftCard: React.FC<{ shift: Shift }> = ({ shift }) => {
        const { user: currentUser, isManager } = useAuth();
        const isMyShift = (shift.allAssignedStaffUids || []).includes(currentUser?.uid || '');
        const biddableSlots = (shift.slots || []).filter(s => !s.assignedStaff && isRoleOrHigher(currentUser?.role, s.roleRequired)).length > 0;
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
                className={`p-2 rounded border-l-4 ${borderColor} ${bgColor} ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            >
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{shift.start.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {!shift.isUnavailability && <span className="text-xs text-gray-500 dark:text-gray-400">{filledSlots}/{totalSlots} Filled</span>}
                </div>
                <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{shift.isUnavailability ? 'Unavailable' : shift.eventName}</p>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-7 border-t border-l border-gray-200 dark:border-gray-700 h-full">
            {weekDays.map(day => {
                const isToday = areDatesTheSame(new Date(), day);
                const dayShifts = shiftsByDay.get(day.toISOString().split('T')[0]) || [];

                return (
                    <div key={day.toString()} className="border-r border-b border-gray-200 dark:border-gray-700 min-h-[20rem]">
                        <div className={`p-2 border-b border-gray-200 dark:border-gray-700 ${isToday ? 'bg-ams-light-blue/10' : ''}`}>
                            <p className="text-center text-sm font-semibold text-gray-500 dark:text-gray-400">{day.toLocaleString('default', { weekday: 'short' })}</p>
                            <p className={`text-center text-2xl font-bold ${isToday ? 'text-ams-blue dark:text-ams-light-blue' : 'text-gray-800 dark:text-gray-200'}`}>{day.getDate()}</p>
                        </div>
                        <div className="p-2 space-y-2">
                            {dayShifts.map(shift => <ShiftCard key={shift.id} shift={shift} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default WeekView;
