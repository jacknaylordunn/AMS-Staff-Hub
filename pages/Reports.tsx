import React, { useState, useEffect, useMemo } from 'react';
import { getAllFinalizedEPRFs, getPendingEPRFs } from '../services/firestoreService';
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
        const totalPatients = filteredEprfs.length;

        // Calculate average on-scene time
        let totalMinutes = 0;
        let validEntries = 0;
        filteredEprfs.forEach(e => {
            if (e.onSceneTime && e.leftSceneTime) {
                try {
                    const [onSceneH, onSceneM] = e.onSceneTime.split(':').map(Number);
                    const [leftSceneH, leftSceneM] = e.leftSceneTime.split(':').map(Number);
                    if (!isNaN(onSceneH) && !isNaN(onSceneM) && !isNaN(leftSceneH) && !isNaN(leftSceneM)) {
                       const start = new Date(0, 0, 0, onSceneH, onSceneM);
                       const end = new Date(0, 0, 0, leftSceneH, leftSceneM);
                       // Fix: Explicitly cast dates to numbers to resolve TypeScript arithmetic operation error.
                       let diff = (Number(end) - Number(start)) / (1000 * 60);
                       if (diff < 0) diff += 24 * 60; // Handle overnight cases
                       totalMinutes += diff;
                       validEntries++;
                    }
                } catch (err) {
                    console.error("Error parsing time for on-scene duration", err);
                }
            }
        });
        const avgOnSceneTime = validEntries > 0 ? Math.round(totalMinutes / validEntries) : 'N/A';
        
        // Data for charts
        const presentationTypes = filteredEprfs.reduce((acc, e) => {
            acc[e.presentationType] = (acc[e.presentationType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const events = filteredEprfs.reduce((acc, e) => {
            const eventName = e.eventName || 'Unknown Event';
            acc[eventName] = (acc[eventName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const dispositions = filteredEprfs.reduce((acc, e) => {
            acc[e.disposition] = (acc[e.disposition] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalPatients,
            avgOnSceneTime,
            presentationTypes: Object.entries(presentationTypes).map(([label, value]) => ({ label, value })),
            events: Object.entries(events).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
            dispositions: Object.entries(dispositions).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value)
        };
    }, [filteredEprfs]);

    const presentationChartData = useMemo(() => [
        { label: 'Medical/Trauma', value: analyticsData.presentationTypes.find(p => p.label === 'Medical/Trauma')?.value || 0, color: '#003366' },
        { label: 'Minor Injury', value: analyticsData.presentationTypes.find(p => p.label === 'Minor Injury')?.value || 0, color: '#00A8E8' },
        { label: 'Welfare/Intox', value: analyticsData.presentationTypes.find(p => p.label === 'Welfare/Intox')?.value || 0, color: '#FFD700' },
    ], [analyticsData.presentationTypes]);
    
    if (loading) {
        return <div className="flex justify-center items-center h-96"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /></div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Performance & Analytics</h1>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="flex-1">
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                    <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                </div>
                <div className="flex-1">
                     <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                    <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <KPICard title="Total Patients Treated" value={analyticsData.totalPatients} description="In selected date range" />
                <KPICard title="ePRFs Pending Review" value={pendingCount} description="Total reports awaiting approval" />
                <KPICard title="Avg. On-Scene Time" value={`${analyticsData.avgOnSceneTime} min`} description="From on-scene to left-scene" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2">
                    <DonutChart data={presentationChartData} title="Presentation Types" />
                </div>
                <div className="lg:col-span-3">
                    <BarChart data={analyticsData.events} title="Incidents by Event" />
                </div>
                <div className="lg:col-span-5">
                     <BarChart data={analyticsData.dispositions} title="Disposition Outcomes" />
                </div>
            </div>
        </div>
    );
};

export default Reports;