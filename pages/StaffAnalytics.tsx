import React, { useState, useEffect, useMemo } from 'react';
import { getStaffAnalytics } from '../services/analyticsService';
import type { UserAnalytics } from '../types';
import { SpinnerIcon } from '../components/icons';
import { showToast } from '../components/Toast';

const StaffAnalytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<UserAnalytics[]>([]);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                const data = await getStaffAnalytics();
                setResults(data);
            } catch (error) {
                console.error("Failed to fetch analytics:", error);
                showToast("Could not load staff analytics.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Staff Analytics</h1>
            
            <p className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg shadow">
                This report shows analytics data for all staff members based on their clock-in/out records. The data is updated automatically in real-time.
            </p>

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                {loading ? (
                    <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" /></div>
                ) : results.length === 0 ? (
                    <p className="text-center py-10 text-gray-500 dark:text-gray-400">No analytics data found. Data will appear as staff clock out of shifts.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Staff Member</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Shifts Worked</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total Hours</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {results.map((result, index) => (
                                    <tr key={index}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">{result.userName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{result.shiftCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{result.totalHours.toFixed(2)}</td>
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