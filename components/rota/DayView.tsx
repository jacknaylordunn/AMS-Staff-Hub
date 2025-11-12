
import React, { useMemo } from 'react';
import type { Shift } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { isRoleOrHigher } from '../../utils/roleHelper';

interface DayViewProps {
    currentDate: Date;
    shifts: Shift[];
    onOpenModal: (shift: Shift | null, date?: Date, type?: 'shift' | 'unavailability') => void;
}

const DayView: React.FC<DayViewProps> = ({ currentDate, shifts, onOpenModal }) => {
    const { user, isManager } = useAuth();
    
    const dayShifts = useMemo(() => {
        return shifts.filter(s => {
            const shiftStart = s.start.toDate();
            const shiftEnd = s.end.toDate();
            const dayStart = new Date(currentDate);
            dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(currentDate);
            dayEnd.setHours(23,59,59,999);
            return shiftStart <= dayEnd && shiftEnd >= dayStart;
        }).sort((a,b) => a.start.toMillis() - b.start.toMillis());
    }, [shifts, currentDate]);

    const hours = Array.from({ length: 24 }).map((_, i) => `${String(i).padStart(2, '0')}:00`);

    const timeToPercent = (date: Date) => {
        return (date.getHours() * 60 + date.getMinutes()) / (24 * 60) * 100;
    };

    return (
        <div className="flex h-full overflow-y-auto">
            <div className="w-16 flex-shrink-0">
                {hours.map(hour => (
                    <div key={hour} className="h-24 text-right pr-2 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700">
                        {hour}
                    </div>
                ))}
            </div>
            <div className="relative flex-grow border-l border-gray-200 dark:border-gray-700">
                {hours.map(hour => <div key={hour} className="h-24 border-t border-gray-200 dark:border-gray-700"></div>)}
                {dayShifts.map(shift => {
                    const shiftStart = shift.start.toDate();
                    const shiftEnd = shift.end.toDate();
                    
                    const dayStart = new Date(currentDate);
                    dayStart.setHours(0,0,0,0);
                    
                    const top = timeToPercent(shiftStart < dayStart ? dayStart : shiftStart);
                    const bottom = timeToPercent(shiftEnd);
                    const height = Math.max(0, bottom - top);
                    
                    const isMyShift = user ? (shift.allAssignedStaffUids || []).includes(user.uid) : false;
                    const biddableSlots = (shift.slots || []).filter(s => !s.assignedStaff && isRoleOrHigher(user?.role, s.roleRequired)).length > 0;

                    let styleClasses = 'bg-gray-400/80 dark:bg-gray-600/80 border-gray-500';
                    if (shift.isUnavailability) styleClasses = 'bg-red-400/80 dark:bg-red-700/80 border-red-500';
                    else if (isMyShift) styleClasses = 'bg-ams-blue/80 dark:bg-ams-blue/80 border-ams-light-blue';
                    else if (biddableSlots) styleClasses = 'bg-green-500/80 dark:bg-green-500/80 border-green-600';
                    else if (shift.status === 'Open') styleClasses = 'bg-yellow-500/80 dark:bg-yellow-500/80 border-yellow-600';
                    else if (shift.status === 'Partially Assigned') styleClasses = 'bg-orange-500/80 dark:bg-orange-500/80 border-orange-600';
                    
                    const isClickable = !shift.isUnavailability || isMyShift || isManager;

                    return (
                        <div
                            key={shift.id}
                            style={{ top: `${top}%`, height: `${height}%` }}
                            onClick={() => isClickable && onOpenModal(shift, undefined, shift.isUnavailability ? 'unavailability' : 'shift')}
                            className={`absolute left-2 right-2 p-2 rounded-lg border-l-4 text-white overflow-y-auto ${styleClasses} ${isClickable ? 'cursor-pointer' : ''}`}
                        >
                            <p className="font-bold text-sm truncate">{shift.isUnavailability ? (isMyShift || user?.role === 'Manager' ? 'Unavailable' : 'Booked Off') : shift.eventName}</p>
                            <p className="text-xs">{shift.start.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            {!shift.isUnavailability && (
                                <div className="mt-1 text-xs space-y-0.5 overflow-hidden">
                                    {(shift.slots || []).map(slot => (
                                        <p key={slot.id} className="truncate">
                                            <span className="font-semibold">{slot.roleRequired}:</span> {slot.assignedStaff ? slot.assignedStaff.name : <span className="opacity-70">Open</span>}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DayView;