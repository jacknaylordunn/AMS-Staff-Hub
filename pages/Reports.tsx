import React, { useState, useEffect, useMemo } from 'react';
// FIX: Corrected import path for EPRF service functions.
import { getAllFinalizedEPRFs, getPendingEPRFs } from '../services/eprfService';
import type { EPRFForm } from '../types';
import { SpinnerIcon } from '../components/icons';

// Component for KPI cards
const KPICard: React.FC<{ title: string; value: string | number; description: string }> = ({ title, value, description }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
        <p className="mt-2 text-3xl font-bold text-ams-blue dark:text-ams-light-blue">{value}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
);

// Component for Bar Chart
const BarChart: React.FC<{ data: { label: string; value: number }[]; title: string }> = ({ data, title }) => {
    const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 0), [data]);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
            <div className="flex justify-around items-end h-64 space-x-2">
                {data.map((item, index) => (
                    <div key={index} className="flex flex-col items-center flex-1 min-w-0">
                        <div className="text-lg font-bold text-ams-blue dark:text-ams-light-blue">{item.value}</div>
                        <div
                            className="w-full bg-ams-light-blue rounded-t-md transition-all duration-500"
                            style={{ height: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                        />
                        <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1 break-words w-full px-1">{item.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Component for Donut Chart
const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[]; title: string }> = ({ data, title }) => {
    const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
    let accumulated = 0;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
            <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-40 h-40">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                        <circle cx="18" cy="18" r="15.915" fill="none" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="3" />
                        {data.map((item, index) => {
                            if (item.value === 0) return null;
                            const percentage = total > 0 ? (item.value / total) * 100 : 0;
                            const strokeDasharray = `${percentage} ${100 - percentage}`;
                            const strokeDashoffset = 25 - accumulated;
                            accumulated += percentage;
                            return (
                                <circle
                                    key={index}
                                    cx="18"
                                    cy="18"
                                    r="15.915"
                                    fill="none"
                                    stroke={item.color}
                                    strokeWidth="3.8"
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    transform="rotate(-90 18 18)"
                                />
                            );
                        })}
                    </svg>
                     <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-800 dark:text-gray-200">{total}</div>
                </div>
                <div className="flex-1">
                    <ul className="space-y-2">
                        {data.map((item, index) => (
                             <li key={index} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                                    <span className="text-sm text-gray-600 dark:text-gray-300">{item.label}</span>
                                </div>
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{item.value}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};


const Reports: React.FC = () => {
    const [eprfs, setEprfs] = useState<EPRFForm[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
    const [endDate, setEndDate] = useState(today);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [data, pendingData] = await Promise.all([
                    getAllFinalizedEPRFs(),
                    getPendingEPRFs()
                ]);
                setEprfs(data);
                setPendingCount(pendingData.length);
            } catch (error) {
                console.error("Failed to fetch reports data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredEprfs = useMemo(() => {
        if (!startDate || !endDate) return eprfs;
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the whole end day

        return eprfs.filter(eprf => {
            const eprfDate = new Date(eprf.incidentDate);
            return eprfDate >= start && eprfDate <= end;
        });
    }, [eprfs, startDate, endDate]);

    const analyticsData = useMemo(() => {
        if (filteredEprfs.length === 0) {
            return {
                totalEncounters: 0,
                presentations: [],
                dispositions: [],
                topImpressions: [],
                topEvents: [],
            };
        }

        const presentations = filteredEprfs.reduce<{[key: string]: number}>((acc, eprf) => {
            acc[eprf.presentationType] = (acc[eprf.presentationType] || 0) + 1;
            return acc;
        }, {});

        const dispositions = filteredEprfs.reduce<{[key: string]: number}>((acc, eprf) => {
            const disp = eprf.disposition || 'Not Set';
            acc[disp] = (acc[disp] || 0) + 1;
            return acc;
        }, {});
        
        const impressions = filteredEprfs.flatMap(e => e.impressions).reduce<{[key: string]: number}>((acc, impression) => {
            acc[impression] = (acc[impression] || 0) + 1;
            return acc;
        }, {});

        const events = filteredEprfs.reduce<{[key: string]: number}>((acc, eprf) => {
            const eventName = eprf.eventName || 'Unknown Event';
            acc[eventName] = (acc[eventName] || 0) + 1;
            return acc;
        }, {});
        
        const topImpressions = Object.entries(impressions)
            // FIX: Explicitly cast sort values to Number to resolve TypeScript error.
            .sort((a, b) => Number(b[1]) - Number(a[1]))
            .slice(0, 5)
            .map(([label, value]) => ({ label, value }));

        const topEvents = Object.entries(events)
            // FIX: Explicitly cast sort values to Number to resolve TypeScript error.
            .sort((a, b) => Number(b[1]) - Number(a[1]))
            .slice(0, 5)
            .map(([label, value]) => ({ label, value }));


        return {
            totalEncounters: filteredEprfs.length,
            presentations: [
                { label: 'Medical/Trauma', value: presentations['Medical/Trauma'] || 0, color: '#00A8E8' },
                { label: 'Minor Injury', value: presentations['Minor Injury'] || 0, color: '#FFD700' },
                { label: 'Welfare/Intox', value: presentations['Welfare/Intox'] || 0, color: '#003366' },
            ],
            dispositions: Object.entries(dispositions).map(([label, value]) => ({ label, value })),
            topImpressions,
            topEvents,
        };
    }, [filteredEprfs]);


    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" />
                <span className="ml-4 text-lg dark:text-gray-300">Generating Reports...</span>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Clinical Reporting</h1>
            
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col md:flex-row gap-4 items-center">
                <label className="font-semibold dark:text-gray-200">Date Range:</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                <span>to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <KPICard title="Total Encounters" value={analyticsData.totalEncounters} description={`Between ${startDate} and ${endDate}`} />
                <KPICard title="ePRFs Pending Review" value={pendingCount} description="Across all time" />
                <KPICard title="Average Encounters/Day" value={(analyticsData.totalEncounters / 30).toFixed(1)} description="In the selected date range (avg)" />
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DonutChart data={analyticsData.presentations} title="Encounters by Presentation Type" />
                <BarChart data={analyticsData.dispositions} title="Patient Dispositions" />
            </div>
        </div>
    );
};

export default Reports;
