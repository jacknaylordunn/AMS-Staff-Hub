import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { getIncidentById, getIncidentMethaneReports, getIncidentStaffCheckins, standDownIncident } from '../services/majorIncidentService';
import type { MajorIncident, METHANEreport, StaffCheckin } from '../types';
import { useAuth } from '../hooks/useAuth';
import { SpinnerIcon, ShieldExclamationIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';

const InfoCard: React.FC<{ title: string; children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow ${className}`}>
        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
        <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-gray-200">{children}</p>
    </div>
);

const MajorIncidentDashboard: React.FC = () => {
    const { incidentId } = ReactRouterDOM.useParams<{ incidentId: string }>();
    const { isManager } = useAuth();
    const [incident, setIncident] = useState<MajorIncident | null>(null);
    const [reports, setReports] = useState<METHANEreport[]>([]);
    const [checkins, setCheckins] = useState<StaffCheckin[]>([]);
    const [loading, setLoading] = useState(true);
    const [isStandDownModalOpen, setStandDownModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!incidentId) return;

        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const incidentData = await getIncidentById(incidentId);
                setIncident(incidentData);
            } catch (error) {
                showToast("Failed to load incident data.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();

        const unsubReports = getIncidentMethaneReports(incidentId, setReports);
        const unsubCheckins = getIncidentStaffCheckins(incidentId, setCheckins);

        return () => {
            unsubReports();
            unsubCheckins();
        };
    }, [incidentId]);

    const groupedCheckins = useMemo(() => {
        const groups: Record<string, StaffCheckin[]> = {
          'Available - On Site': [],
          'Available - En Route': [],
          'Unavailable': [],
        };
        checkins.forEach(ci => {
          if (groups[ci.status]) {
            groups[ci.status].push(ci);
          }
        });
        return groups;
      }, [checkins]);

    const handleStandDown = async () => {
        if (!incidentId) return;
        setIsProcessing(true);
        try {
            await standDownIncident(incidentId);
            setIncident(prev => prev ? { ...prev, status: 'Stood Down' } : null);
            showToast("Incident has been stood down.", "success");
        } catch (error) {
            showToast("Failed to stand down incident.", "error");
        } finally {
            setIsProcessing(false);
            setStandDownModalOpen(false);
        }
    };
    
    const getStatusColor = (status: StaffCheckin['status']) => {
        if (status.startsWith('Available')) return 'border-green-500';
        if (status === 'Unavailable') return 'border-red-500';
        return 'border-gray-500';
    };

    if (loading) {
        return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /></div>;
    }

    if (!incident) {
        return <div className="text-center p-10 text-xl text-gray-600 dark:text-gray-300">Incident not found.</div>;
    }

    return (
        <div>
            <ConfirmationModal isOpen={isStandDownModalOpen} onClose={() => setStandDownModalOpen(false)} onConfirm={handleStandDown} title="Stand Down Incident" message="Are you sure you want to stand down this incident? This will notify all staff." confirmText="Stand Down" isLoading={isProcessing} />

            <div className={`p-4 rounded-lg mb-6 flex justify-between items-center ${incident.status === 'Active' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">{incident.name}</h1>
                    <p className="text-gray-600 dark:text-gray-400">{incident.location}</p>
                    {incident.status === 'Active' && <p className="font-bold text-red-600 animate-pulse">INCIDENT ACTIVE</p>}
                </div>
                {isManager && incident.status === 'Active' && (
                    <button onClick={() => setStandDownModalOpen(true)} className="px-4 py-2 bg-ams-blue text-white font-semibold rounded-md shadow hover:bg-opacity-90">
                        Stand Down Incident
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <InfoCard title="Status">{incident.status}</InfoCard>
                <InfoCard title="Declared At">{incident.declaredAt.toDate().toLocaleTimeString()}</InfoCard>
                <InfoCard title="Personnel Checked In">{checkins.length}</InfoCard>
                <InfoCard title="METHANE Reports">{reports.length}</InfoCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Personnel Status</h2>
                    <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                        {Object.entries(groupedCheckins).map(([status, staff]) => (
                            <div key={status}>
                                <h3 className={`text-lg font-semibold border-l-4 pl-2 mb-2 ${getStatusColor(status as StaffCheckin['status'])}`}>{status} ({staff.length})</h3>
                                {staff.length > 0 ? (
                                    <div className="space-y-2 pl-3">
                                        {staff.map(ci => (
                                            <div key={ci.userId} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                                <p className="font-semibold dark:text-gray-200">{ci.userName}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{ci.userRole} - Updated at {ci.timestamp.toDate().toLocaleTimeString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="pl-3 text-sm text-gray-400">No staff in this category.</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">METHANE Report Log</h2>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        {reports.length > 0 ? reports.map(r => (
                            <div key={r.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-ams-light-blue">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b dark:border-gray-600">
                                    <h3 className="font-bold text-ams-blue dark:text-ams-light-blue">METHANE Report</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{r.submittedAt.toDate().toLocaleTimeString()} by {r.submittedBy.name}</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <p><strong className="text-gray-500 dark:text-gray-400">M:</strong> {r.majorIncident}</p>
                                    <p><strong className="text-gray-500 dark:text-gray-400">E:</strong> {r.exactLocation}</p>
                                    <p><strong className="text-gray-500 dark:text-gray-400">T:</strong> {r.typeOfIncident}</p>
                                    <p><strong className="text-gray-500 dark:text-gray-400">H:</strong> {r.hazards}</p>
                                    <p><strong className="text-gray-500 dark:text-gray-400">A:</strong> {r.access}</p>
                                    <p><strong className="text-gray-500 dark:text-gray-400">N:</strong> {r.numberOfCasualties}</p>
                                    <p className="sm:col-span-2"><strong className="text-gray-500 dark:text-gray-400">E:</strong> {r.emergencyServices}</p>
                                </div>
                            </div>
                        )) : <p className="text-sm text-gray-500 dark:text-gray-400">No METHANE reports submitted yet.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MajorIncidentDashboard;