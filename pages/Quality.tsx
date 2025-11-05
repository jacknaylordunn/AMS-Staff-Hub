import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuditResults } from '../services/auditService';
import type { AiAuditResult } from '../types';
import { SpinnerIcon, QualityIcon } from '../components/icons';

const KPICard: React.FC<{ title: string; value: string | number; description: string }> = ({ title, value, description }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
        <p className="mt-2 text-3xl font-bold text-ams-blue dark:text-ams-light-blue">{value}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
);

const TrendList: React.FC<{ title: string; items: { label: string; count: number }[] }> = ({ title, items }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
        <ul className="space-y-2">
            {items.map((item, index) => (
                <li key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{item.label}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{item.count}</span>
                </li>
            ))}
        </ul>
    </div>
);

const Quality: React.FC = () => {
    const [audits, setAudits] = useState<AiAuditResult[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const results = await getAuditResults();
                setAudits(results);
            } catch (error) {
                console.error("Failed to fetch audit results:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const aggregateData = useMemo(() => {
        if (audits.length === 0) {
            return {
                avgCompleteness: 0,
                avgAdherence: 0,
                avgDocumentation: 0,
                avgOverall: 0,
                commonStrengths: [],
                commonImprovements: [],
            };
        }

        const reduceToCount = (items: string[]) => {
            const counts = items.reduce<Record<string, number>>((acc, item) => {
                acc[item] = (acc[item] || 0) + 1;
                return acc;
            }, {});
            return Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([label, count]) => ({ label, count }));
        };

        return {
            avgCompleteness: audits.reduce((sum, a) => sum + a.completenessScore, 0) / audits.length,
            avgAdherence: audits.reduce((sum, a) => sum + a.guidelineAdherenceScore, 0) / audits.length,
            avgDocumentation: audits.reduce((sum, a) => sum + a.documentationScore, 0) / audits.length,
            avgOverall: audits.reduce((sum, a) => sum + a.overallScore, 0) / audits.length,
            commonStrengths: reduceToCount(audits.flatMap(a => a.strengths)),
            commonImprovements: reduceToCount(audits.flatMap(a => a.areasForImprovement)),
        };
    }, [audits]);
    
    const exemplaryReports = useMemo(() => {
        return [...audits].sort((a, b) => b.overallScore - a.overallScore).slice(0, 3);
    }, [audits]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" />
                <span className="ml-4 text-lg dark:text-gray-300">Loading Quality Data...</span>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Clinical Quality Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <KPICard title="Overall Score" value={`${aggregateData.avgOverall.toFixed(0)}%`} description="Average across all audits" />
                <KPICard title="Completeness" value={`${aggregateData.avgCompleteness.toFixed(0)}%`} description="Average documentation score" />
                <KPICard title="Guideline Adherence" value={`${aggregateData.avgAdherence.toFixed(0)}%`} description="Average JRCALC adherence" />
                <KPICard title="Total Audits" value={audits.length} description="Total ePRFs analyzed by AI" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <TrendList title="Common Strengths" items={aggregateData.commonStrengths} />
                <TrendList title="Common Areas for Improvement" items={aggregateData.commonImprovements} />
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Exemplary Reports</h3>
                    <ul className="space-y-3">
                        {exemplaryReports.map(audit => (
                            <li key={audit.id} onClick={() => navigate(`/patients/${audit.patientId}`)} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-sm text-ams-blue dark:text-ams-light-blue">{audit.eventName}</p>
                                    <span className="font-bold text-green-600">{audit.overallScore}%</span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{audit.incidentDate}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 p-6">All Audited Reports</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Encounter</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Overall Score</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Summary</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Audited By</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {audits.map(audit => (
                                <tr key={audit.id} onClick={() => navigate(`/patients/${audit.patientId}`)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{audit.eventName}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{audit.incidentDate}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-ams-blue dark:text-ams-light-blue">{audit.overallScore}%</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-sm truncate">{audit.summary}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{audit.auditedBy.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Quality;