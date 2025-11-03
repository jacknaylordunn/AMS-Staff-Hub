
import React, { useState } from 'react';
import type { Shift } from '../types';

const mockShifts: Shift[] = [
    { id: '1', title: 'Event Medic - City Marathon', start: new Date(2024, 6, 2, 8, 0), end: new Date(2024, 6, 2, 20, 0), role: 'Medic' },
    { id: '2', title: 'Nightclub Support - Venue X', start: new Date(2024, 6, 5, 21, 0), end: new Date(2024, 6, 6, 4, 0), role: 'First Responder' },
    { id: '3', title: 'Office Duty', start: new Date(2024, 6, 10, 9, 0), end: new Date(2024, 6, 10, 17, 0), role: 'Admin' },
    { id: '4', title: 'Music Festival - Site Build', start: new Date(2024, 6, 15, 10, 0), end: new Date(2024, 6, 15, 18, 0), role: 'Welfare' },
    { id: '5', title: 'Music Festival - Main Event', start: new Date(2024, 6, 16, 12, 0), end: new Date(2024, 6, 17, 1, 0), role: 'Medic' },
];

const Rota: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date(2024, 6, 1)); // Default to July 2024 for demo

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days = [];
    let day = startDate;
    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }
    
    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    }

    const shiftsForDay = (date: Date) => {
        return mockShifts.filter(shift =>
            shift.start.getFullYear() === date.getFullYear() &&
            shift.start.getMonth() === date.getMonth() &&
            shift.start.getDate() === date.getDate()
        );
    }
    
    const getRoleColor = (role: string) => {
        switch (role) {
            case 'Medic': return 'bg-red-500';
            case 'First Responder': return 'bg-blue-500';
            case 'Welfare': return 'bg-green-500';
            case 'Admin': return 'bg-gray-500';
            default: return 'bg-purple-500';
        }
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-ams-blue text-white rounded">&lt; Prev</button>
                <h2 className="text-2xl font-bold text-gray-800">
                    {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                </h2>
                <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-ams-blue text-white rounded">Next &gt;</button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
                    <div key={dayName} className="text-center font-bold bg-gray-100 py-2">{dayName}</div>
                ))}

                {days.map((d, i) => {
                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                    const isToday = new Date().toDateString() === d.toDateString();
                    const dayShifts = shiftsForDay(d);
                    
                    return (
                        <div key={i} className={`p-2 h-36 bg-white ${isCurrentMonth ? '' : 'bg-gray-50'}`}>
                            <div className={`flex justify-center items-center h-8 w-8 rounded-full ${isToday ? 'bg-ams-light-blue text-white' : ''}`}>
                                {d.getDate()}
                            </div>
                            <div className="mt-1 space-y-1 overflow-y-auto max-h-20">
                                {dayShifts.map(shift => (
                                    <div key={shift.id} className={`p-1 rounded text-white text-xs ${getRoleColor(shift.role)}`}>
                                        <p className="font-semibold truncate">{shift.title}</p>
                                        <p>{shift.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Rota;
