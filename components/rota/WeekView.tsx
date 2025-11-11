
import React, { useMemo } from 'react';
import type { Shift, User } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { getStartOfWeek, addDays, areDatesTheSame } from '../../utils/dateHelpers';
import { isRoleOrHigher } from '../../utils/roleHelper';

interface WeekViewProps {
    currentDate: Date;
    shifts: Shift[];
    onOpenModal: (shift: Shift | null, date?: Date, type?: 'shift' | 'unavailability') => void;
}

const WeekView: React.FC<WeekViewProps> = ({ currentDate, shifts, onOpenModal }) => {
    const { user } = useAuth();

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
                shiftStart.setHours(0,0,0,0);
                shiftEnd.setHours(23,59,59,999);
                return day >= shiftStart && day <= shiftEnd;
            }).sort((a, b) => a.start.toMillis() - b.start.toMillis());
            map.set(dayString, dayShifts);
        });
        return map;
    }, [shifts, weekDays]);

    const ShiftItem: React.FC<{ shift: Shift }> = ({ shift }) => {
        const { user: currentUser, isManager } = useAuth();
        const isMyShift = (shift.allAssignedStaffUids || []).includes(currentUser?.uid || '');
        const biddableSlots = (shift.slots || []).filter(s => !s.assignedStaff && isRoleOrHigher(currentUser?.role, s.roleRequired)).length > 0;

        let styleClasses = 'bg-gray-100 dark:bg-gray-700 border-l-4 border-gray-400';
        let textColor = 'text-gray-800 dark:text-gray-200';
        if (shift.isUnavailability) {
             styleClasses = 'bg-red-100 dark:bg-red-900/50 border-l-4 border-red-400';
             textColor = 'text-red-800 dark:text-red-200';
        }
        else if (isMyShift) {
            styleClasses = 'bg-ams-blue/10 dark:bg-ams-blue/30 border-l-4 border-ams-blue';
            textColor = 'text-ams-blue dark:text-ams-light-blue font-semibold';
        }
        else if (biddableSlots) {
             styleClasses = 'bg-green-100 dark:bg-green-900/50 border-l-4 border-green-400';
             textColor = 'text-green-800 dark:text-green-200';
        }

        const filledSlots = (shift.slots || []).filter(s => s.assignedStaff).length;
        const totalSlots = (shift.slots || []).length;
        const isClickable = !shift.isUnavailability || isMyShift || isManager;
        
        return (
            <div onClick={() => isClickable && onOpenModal(shift, undefined, shift.isUnavailability ? 'unavailability' : 'shift')} 
                 className={`p-2 rounded-md ${styleClasses} ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
                <p className={`text-sm font-bold truncate ${textColor}`}>{shift.isUnavailability ? 'Unavailable' : shift.eventName}</p>
                {!shift.isUnavailability && (
                    <>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{shift.start.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{filledSlots}/{totalSlots} filled</p>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="grid grid-cols-7 border-t border-l border-gray-200 dark:border-gray-700 h-full">
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
                            {dayShifts.map(shift => <ShiftItem key={shift.id} shift={shift} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default WeekView;
