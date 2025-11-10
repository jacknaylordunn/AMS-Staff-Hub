

import React, { useState } from 'react';
// FIX: Use compat firestore types.
// FIX: The 'firestore' named export does not exist on 'firebase/compat/app'. Changed to default import 'firebase' and used 'firebase.firestore.Timestamp' to create a new timestamp.
import firebase from 'firebase/compat/app';
import type { Shift } from '../types';
import { createMultipleShifts } from '../services/rotaService';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface RepeatShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
  onSave: () => void;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RepeatShiftModal: React.FC<RepeatShiftModalProps> = ({ isOpen, onClose, shift, onSave }) => {
    const originalEventDay = shift.start.toDate().getDay();
    
    const [repeatType, setRepeatType] = useState<'weekly' | 'monthly'>('weekly');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([originalEventDay]);
    const [untilDate, setUntilDate] = useState(() => {
        const nextMonth = shift.start.toDate();
        nextMonth.setMonth(nextMonth.getMonth() + 3); // Default to 3 months in the future
        return nextMonth.toISOString().split('T')[0];
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleDayToggle = (dayIndex: number) => {
        setDaysOfWeek(prev => 
            prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
        );
    };

    const handleSave = async () => {
        setLoading(true);
        const newShifts: Omit<Shift, 'id'>[] = [];
        // FIX: Destructure using the correct properties of the Shift type.
        const { id, status, slots, allAssignedStaffUids, ...baseShift } = shift;
        
        const startDate = shift.start.toDate();
        const endDate = new Date(untilDate + 'T12:00:00Z');

        if (endDate <= startDate) {
            showToast("End date must be after the original event date.", "error");
            setLoading(false);
            return;
        }

        const shiftDuration = shift.end.toMillis() - shift.start.toMillis();

        // FIX: Create new slots with cleared assignments and bids.
        const newSlots = (shift.slots || []).map(s => ({
            ...s,
            assignedStaff: null,
            bids: [],
        }));

        if (repeatType === 'weekly') {
            let currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + 1); // Start checking from the day after
            while(currentDate <= endDate) {
                if (daysOfWeek.includes(currentDate.getDay())) {
                     const newStart = new Date(currentDate);
                     newStart.setHours(startDate.getHours(), startDate.getMinutes());
                     const newEnd = new Date(newStart.getTime() + shiftDuration);

                     // FIX: Construct the new shift object with the correct properties.
                     newShifts.push({ 
                        ...baseShift, 
                        start: firebase.firestore.Timestamp.fromDate(newStart),
                        end: firebase.firestore.Timestamp.fromDate(newEnd),
                        slots: newSlots,
                        allAssignedStaffUids: [],
                        status: 'Open',
                     });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else if (repeatType === 'monthly') {
            let currentDate = new Date(startDate);
            currentDate.setMonth(currentDate.getMonth() + 1);

            while(currentDate <= endDate) {
                const dayOfMonth = startDate.getDate();
                let newEventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayOfMonth);

                if (newEventDate.getMonth() !== currentDate.getMonth()) {
                    newEventDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                }

                if (newEventDate <= endDate) {
                     const newStart = new Date(newEventDate);
                     newStart.setHours(startDate.getHours(), startDate.getMinutes());
                     const newEnd = new Date(newStart.getTime() + shiftDuration);
                    // FIX: Construct the new shift object with the correct properties.
                    newShifts.push({ 
                        ...baseShift,
                        start: firebase.firestore.Timestamp.fromDate(newStart),
                        end: firebase.firestore.Timestamp.fromDate(newEnd),
                        slots: newSlots,
                        allAssignedStaffUids: [],
                        status: 'Open',
                    });
                }
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
        
        try {
            await createMultipleShifts(newShifts);
            showToast(`Successfully created ${newShifts.length} repeated shifts.`, "success");
            onSave();
            onClose();
        } catch (e) {
            showToast("Failed to create repeated shifts.", "error");
        } finally {
            setLoading(false);
        }
    };
    
    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center modal-overlay" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-2">Repeat Shift</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Create multiple occurrences for "{shift.eventName}".</p>
                <div className="space-y-4">
                    <div>
                        <label className={labelClasses}>Repeat</label>
                        <select value={repeatType} onChange={e => setRepeatType(e.target.value as any)} className={inputClasses}>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>

                    {repeatType === 'weekly' && (
                        <div>
                            <label className={labelClasses}>On days</label>
                            <div className="mt-2 flex justify-between rounded-lg shadow-sm">
                                {WEEK_DAYS.map((day, index) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => handleDayToggle(index)}
                                        className={`flex-1 p-2 text-sm font-medium border-y border-r first:border-l first:rounded-l-md dark:border-gray-600
                                            ${daysOfWeek.includes(index) ? 'bg-ams-blue text-white' : 'bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {repeatType === 'monthly' && (
                        <div>
                            <label className={labelClasses}>On the</label>
                            {/* FIX: Replaced invalid 'readOnly' prop with 'disabled' for the select element. */}
                            <select value="dayOfMonth" disabled className={inputClasses}>
                                <option value="dayOfMonth">Day {shift.start.toDate().getDate()}</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className={labelClasses}>Ends on</label>
                        <input type="date" value={untilDate} onChange={e => setUntilDate(e.target.value)} className={inputClasses} />
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                        {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                        Create Shifts
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RepeatShiftModal;