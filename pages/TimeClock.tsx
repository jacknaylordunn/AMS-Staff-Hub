import React, { useState, useEffect } from 'react';
import type { Shift, TimeClockEntry } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
// FIX: Changed import path to point to the .tsx file to resolve module ambiguity.
import { clockIn, clockOut, getTimeClockEntriesForDateRange } from '../services/timeClockService';
import { getShiftsForUser } from '../services/rotaService';
import { SpinnerIcon } from '../components/icons';
import { showToast } from '../components/Toast';

const getCurrentLocation = (): Promise<GeolocationCoordinates | null> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser.", "info");
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position.coords),
            (error) => {
                showToast(`Could not get location: ${error.message}`, "error");
                resolve(null); // Resolve with null on error, allowing clock-in without location
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
};

const StaffTimeClock: React.FC = () => {
    const { user } = useAuth();
    const { activeClockIn, setActiveClockIn } = useAppContext();
    const [userShifts, setUserShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const today = new Date();
        // Fetch shifts for today
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        getShiftsForUser(user.uid, startOfDay.getFullYear(), startOfDay.getMonth())
            .then(shifts => {
                const todayShifts = shifts.filter(s => {
                    const shiftStart = s.start.toDate();
                    return shiftStart >= startOfDay && shiftStart <= endOfDay && !s.isUnavailability;
                });
                setUserShifts(todayShifts);
            })
            .catch(() => showToast("Failed to load today's shifts.", "error"))
            .finally(() => setLoading(false));
    }, [user]);

    const handleClockIn = async (shift: Shift) => {
        if (!user) return;
        setIsProcessing(true);
        showToast("Getting your location...", "info");
        const location = await getCurrentLocation();
        try {
            const newClockInEntry = await clockIn(shift, user, location);
            setActiveClockIn(newClockInEntry);
            showToast("Successfully clocked in.", "success");
        } catch (error) {
            showToast("Failed to clock in.", "error");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleClockOut = async () => {
        if (!activeClockIn) return;
        setIsProcessing(true);
        showToast("Getting your location...", "info");
        const location = await getCurrentLocation();
        try {
            await clockOut(activeClockIn.id!, activeClockIn.clockInTime, location);
            setActiveClockIn(null);
            showToast("Successfully clocked out.", "success");
        } catch(error) {
            showToast("Failed to clock out.", "error");
        } finally {
            setIsProcessing(false);
        }
    };
    
    if (loading) return <div className="flex justify-center p-8"><SpinnerIcon className="w-8 h-8 text-ams-blue" /></div>;

    if (activeClockIn) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-green-600 text-center">You are Clocked In</h2>
                <div className="mt-4 text-center">
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{activeClockIn.shiftName}</p>
                    <p className="text-gray-500 dark:text-gray-400">
                        Clocked in at: {activeClockIn.clockInTime.toDate().toLocaleTimeString()}
                    </p>
                </div>
                <button 
                    onClick={handleClockOut}
                    disabled={isProcessing}
                    className="w-full mt-6 px-4 py-3 font-bold text-white bg-red-600 rounded-md flex items-center justify-center hover:bg-red-700 disabled:bg-gray-400"
                >
                    {isProcessing && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                    Clock Out
                </button>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Today's Shifts</h2>
            {userShifts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userShifts.map(shift => {
                        // FIX: Find the user's specific slot to get their role for this shift.
                        const mySlot = shift.slots.find(s => s.assignedStaff?.uid === user?.uid);
                        return (
                        <div key={shift.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col justify-between border-l-4 border-ams-blue dark:border-ams-light-blue">
                             <div>
                                <h3 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">{shift.eventName}</h3>
                                <p className="text-gray-700 dark:text-gray-300 font-semibold">{mySlot?.roleRequired}</p>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                    {shift.start.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {shift.end.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            </div>
                            <button onClick={() => handleClockIn(shift)} disabled={isProcessing} className="w-full mt-4 px-4 py-2 font-semibold text-white bg-ams-light-blue rounded-md flex items-center justify-center hover:bg-opacity-90 disabled:bg-gray-400">
                                {isProcessing && <SpinnerIcon className="w-5 h-5 mr-2" />}
                                Clock In
                            </button>
                        </div>
                    )})}
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    You have no shifts scheduled for today.
                </div>
            )}
        </div>
    );
};

const TimeClockRecords: React.FC = () => {
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [records, setRecords] = useState<TimeClockEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const handleFetchRecords = async () => {
        setLoading(true);
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            const data = await getTimeClockEntriesForDateRange(start, end);
            setRecords(data);
        } catch (e) {
            showToast("Failed to fetch time clock records.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleFetchRecords();
    }, []);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                <span>to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                <button onClick={handleFetchRecords} disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                    {loading ? <SpinnerIcon className="w-5 h-5"/> : 'Fetch Records'}
                </button>
            </div>
            {loading ? <div className="flex justify-center p-8"><SpinnerIcon className="w-8 h-8 text-ams-blue" /></div> :
            <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700"><tr>
                        {['Staff', 'Shift', 'Clock In', 'Clock Out', 'Duration', 'Location'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{h}</th>)}
                    </tr></thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {records.map(r => (
                            <tr key={r.id}>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">{r.userName}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">{r.shiftName}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">{r.clockInTime.toDate().toLocaleString()}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">{r.clockOutTime?.toDate().toLocaleString() || 'Still Active'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">{r.durationHours?.toFixed(2) || 'N/A'} hrs</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    {r.clockInLocation && <a href={`https://www.google.com/maps?q=${r.clockInLocation.latitude},${r.clockInLocation.longitude}`} target="_blank" rel="noopener noreferrer" className="text-ams-light-blue hover:underline">In</a>}
                                    {r.clockOutLocation && <a href={`https://www.google.com/maps?q=${r.clockOutLocation.latitude},${r.clockOutLocation.longitude}`} target="_blank" rel="noopener noreferrer" className="text-ams-light-blue hover:underline ml-2">Out</a>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
            }
        </div>
    );
};

const TimeClockPage: React.FC = () => {
    const { isManager } = useAuth();

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Time Clock</h1>
            {isManager ? <TimeClockRecords /> : <StaffTimeClock />}
        </div>
    );
};

export default TimeClockPage;
