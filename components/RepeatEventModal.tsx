import React, { useState } from 'react';
import type { EventLog } from '../types';
import { createMultipleEvents } from '../services/eventService';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface RepeatEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventLog;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RepeatEventModal: React.FC<RepeatEventModalProps> = ({ isOpen, onClose, event }) => {
    const originalEventDay = new Date(event.date + 'T12:00:00').getDay();
    const [repeatType, setRepeatType] = useState<'weekly' | 'monthly'>('weekly');
    const [interval, setInterval] = useState(1);
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([originalEventDay]);
    const [monthlyType, setMonthlyType] = useState<'dayOfMonth'>('dayOfMonth');
    const [untilDate, setUntilDate] = useState(() => {
        const nextMonth = new Date(event.date + 'T12:00:00');
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
        const newEvents: Omit<EventLog, 'id' | 'status'>[] = [];
        const { name, location } = event;
        const startDate = new Date(event.date + 'T12:00:00Z');
        const endDate = new Date(untilDate + 'T12:00:00Z');

        if (endDate <= startDate) {
            showToast("End date must be after the original event date.", "error");
            setLoading(false);
            return;
        }

        if (repeatType === 'weekly') {
            let currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + 1); // Start checking from the day after
            while(currentDate <= endDate) {
                if (daysOfWeek.includes(currentDate.getDay())) {
                     newEvents.push({ name, location, date: currentDate.toISOString().split('T')[0] });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else if (repeatType === 'monthly') {
            let currentDate = new Date(startDate);
            currentDate.setMonth(currentDate.getMonth() + 1);

            while(currentDate <= endDate) {
                const dayOfMonth = startDate.getDate();
                let newEventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayOfMonth);

                // If we set day 31 in a 30-day month, it rolls over. Check if month is still the same.
                if (newEventDate.getMonth() !== currentDate.getMonth()) {
                    // It rolled over, so this day doesn't exist. Find last day of target month.
                    newEventDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                }

                if (newEventDate <= endDate) {
                    newEvents.push({ name, location, date: newEventDate.toISOString().split('T')[0] });
                }
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
        
        try {
            await createMultipleEvents(newEvents);
            showToast(`Successfully created ${newEvents.length} repeated events.`, "success");
            onClose();
        } catch (e) {
            showToast("Failed to create repeated events.", "error");
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
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-2">Repeat Event</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Create multiple occurrences for "{event.name}".</p>
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
                                        className={`flex-1 p-2 text-sm font-medium border-y border-r first:border-l first:rounded-l-md last:rounded-r-md dark:border-gray-600
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
                            <select value={monthlyType} onChange={e => setMonthlyType(e.target.value as any)} className={inputClasses}>
                                <option value="dayOfMonth">Day {new Date(event.date + 'T12:00:00').getDate()}</option>
                                {/* Add logic for "Nth weekday" in the future if needed */}
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
                        Create Events
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RepeatEventModal;
