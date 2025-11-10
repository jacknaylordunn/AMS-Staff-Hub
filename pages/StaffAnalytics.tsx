import React, { useState, useEffect, useMemo } from 'react';
import { getUsers } from '../services/userService';
import { getShiftsForDateRange } from '../services/rotaService';
import type { User, Shift } from '../types';
import { SpinnerIcon } from '../components/icons';
import { showToast } from '../components/Toast';

interface AnalyticsResult {
    [userId: string]: {
        name: string;
        shiftCount: number;
        totalHours: number;
    }
}

const StaffAnalytics: React.FC = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<AnalyticsResult>({});

    const handleGenerateReport = async () => {
        setLoading(true);
        setResults({});
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include the whole end day

            if (start > end) {
                showToast("Start date cannot be after end date.", "error");
                setLoading(false);
                return;
            }

            const [shifts, users] = await Promise.all([
                getShiftsForDateRange(start, end),
                getUsers()
            ]);

            const analytics: AnalyticsResult = {};

            users.forEach(user => {
                analytics[user.uid] = {
                    name: `${user.firstName} ${user.lastName}`,
                    shiftCount: 0,
                    totalHours: 0,
                };
            });

            shifts.forEach(shift => {
                if (shift.isUnavailability) return;

                const durationHours = (shift.end.toMillis() - shift.start.toMillis()) / (1000 * 60 * 60);

                // FIX: Iterate through slots to find assigned staff.
                shift.slots.forEach(slot => {
                    if (slot.assignedStaff) {
                        const staff = slot.assignedStaff;
                        if (analytics[staff.uid]) {
                            analytics[staff.uid].shiftCount += 1;
                            analytics[staff.uid].totalHours += durationHours;
                        }
                    }
                });
            });

            setResults(analytics);
        } catch (error) {
            console.error("Failed to generate analytics report:", error);
            showToast("An error occurred while generating the report.", "error");
        } finally {
            setLoading(false);
        }
    };
    
    const sortedResults = useMemo(() => {
        return Object.values(results).sort((a: { totalHours: number }, b: { totalHours: number }) => b.totalHours - a.totalHours);
    }, [results]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Staff Analytics</h1>
            
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col md:flex-row gap-4 items-center">
                <label className="font-semibold dark:text-gray-200">Date Range:</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                <span>to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                <button 
                    onClick={handleGenerateReport}
                    disabled={loading}
                    className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center"
                >
                    {loading && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                    Generate Report
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                {loading ? (
                    <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" /></div>
                ) : Object.keys(results).length === 0 ? (
                    <p className="text-center py-10 text-gray-500 dark:text-gray-400">Select a date range and click "Generate Report" to see staff hours.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Staff Member</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total Shifts</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total Hours</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {sortedResults.map(res => (
                                    <tr key={res.name}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-gray-200">{res.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{res.shiftCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{res.totalHours.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffAnalytics;
