import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPatientById, getEPRFsForPatient, approveEPRF, returnEPRFToDraft } from '../services/firestoreService';
import type { Patient, EPRFForm, VitalSign, MedicationAdministered, Intervention, AuditEntry } from '../types';
import { SpinnerIcon, PdfIcon, CheckIcon, TimelineIcon, FormIcon, AuditIcon } from '../components/icons';
import EPRFView from '../components/EPRFView';
import { generateHandoverPdf } from '../utils/pdfGenerator';
import { showToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import ConfirmationModal from '../components/ConfirmationModal';

const DetailCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">{title}</h3>
        <div className="space-y-2 text-gray-700 dark:text-gray-300">{children}</div>
    </div>
);


type TimelineEvent = {
    time: string;
    type: 'vital' | 'medication' | 'intervention';
    data: VitalSign | MedicationAdministered | Intervention;
}

const ClinicalTimeline: React.FC<{ eprf: EPRFForm }> = ({ eprf }) => {
    const timelineEvents = useMemo(() => {
        const events: TimelineEvent[] = [];
        eprf.vitals.forEach(v => events.push({ time: v.time, type: 'vital', data: v }));
        eprf.medicationsAdministered.forEach(m => events.push({ time: m.time, type: 'medication', data: m }));
        eprf.interventions.forEach(i => events.push({ time: i.time, type: 'intervention', data: i }));

        return events.sort((a, b) => a.time.localeCompare(b.time));
    }, [eprf]);
    
    const getEventContent = (event: TimelineEvent) => {
        switch(event.type) {
            case 'vital':
                const v = event.data as VitalSign;
                return `Vitals: HR ${v.hr}, RR ${v.rr}, BP ${v.bp}, SpO2 ${v.spo2}%, Temp ${v.temp}°C, NEWS2: ${v.news2 ?? 'N/A'}`;
            case 'medication':
                const m = event.data as MedicationAdministered;
                return `Medication: ${m.medication} ${m.dose} via ${m.route}`;
            case 'intervention':
                const i = event.data as Intervention;
                return `Intervention: ${i.intervention} - ${i.details}`;
        }
    };
    
    const getEventColor = (type: TimelineEvent['type']) => {
        switch(type) {
            case 'vital': return 'bg-blue-500';
            case 'medication': return 'bg-green-500';
            case 'intervention': return 'bg-purple-500';
        }
    }

    if (timelineEvents.length === 0) {
        return <div className="text-center p-10 text-gray-500 dark:text-gray-400">No timed events recorded for this encounter.</div>
    }

    return (
         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-h-[80vh] overflow-y-auto">
             <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">Clinical Timeline for {eprf.incidentDate}</h3>
            <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4">
                {timelineEvents.map((event, index) => (
                    <div key={index} className="mb-8 ml-8">
                        <span className={`absolute -left-4 flex items-center justify-center w-8 h-8 ${getEventColor(event.type)} rounded-full ring-8 ring-white dark:ring-gray-800`}>
                           {/* Icon can go here */}
                        </span>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm">
                            <time className="text-lg font-semibold text-gray-900 dark:text-white">{event.time}</time>
                            <p className="mt-2 text-base font-normal text-gray-600 dark:text-gray-300">{getEventContent(event)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AuditTrailView: React.FC<{ auditLog: AuditEntry[] }> = ({ auditLog }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">ePRF Audit Trail</h3>
             <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4">
                {auditLog.map((entry, index) => (
                    <div key={index} className="mb-6 ml-8">
                        <span className="absolute -left-4 flex items-center justify-center w-8 h-8 bg-gray-400 rounded-full ring-8 ring-white dark:ring-gray-800"/>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm">
                            <p className="text-md font-semibold text-gray-900 dark:text-white">{entry.action}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">by <span className="font-medium">{entry.user.name}</span></p>
                            <time className="block text-xs font-normal leading-none text-gray-400 dark:text-gray-500 mt-1">{entry.timestamp.toDate().toLocaleString()}</time>
                            {entry.details && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 p-2 rounded-md">Reason: {entry.details}</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const ReturnToDraftModal: React.FC<{ isOpen: boolean, onClose: () => void, onConfirm: (reason: string) => void, isLoading: boolean }> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    const [reason, setReason] = useState('');
    if (!isOpen) return null;
    
    const handleConfirm = () => {
        if (reason.trim()) {
            onConfirm(reason);
        } else {
            showToast("A reason is required to return a draft.", "error");
        }
    };
    
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-modal-title"
            aria-describedby="return-modal-description"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <h2 id="return-modal-title" className="text-xl font-bold text-gray-900 dark:text-white mb-4">Return ePRF for Correction</h2>
                <p id="return-modal-description" className="text-gray-600 dark:text-gray-300 mb-4">Please provide a reason for returning this ePRF to draft status. The clinician will be notified.</p>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={4}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    placeholder="e.g., Missing vital signs at 14:30..."
                />
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                    <button onClick={handleConfirm} disabled={isLoading} className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 flex items-center">
                        {isLoading && <SpinnerIcon className="w-5 h-5 mr-2"/>} Return to Draft
                    </button>
                </div>
            </div>
        </div>
    );
};


const PatientDetail: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const { user, isManager } = useAuth();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [eprfs, setEprfs] = useState<EPRFForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEPRF, setSelectedEPRF] = useState<EPRFForm | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [isReturning, setIsReturning] = useState(false);
    const [isReturnModalOpen, setReturnModalOpen] = useState(false);
    const [view, setView] = useState<'form' | 'timeline' | 'audit'>('form');

    const fetchData = async () => {
        if (!patientId) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const patientData = await getPatientById(patientId);
            const eprfData = await getEPRFsForPatient(patientId);
            setPatient(patientData);
            setEprfs(eprfData);
            if (eprfData.length > 0 && !selectedEPRF) {
                setSelectedEPRF(eprfData[0]);
            } else if (selectedEPRF) {
                // If an ePRF was selected, find its updated version in the new data
                const updatedSelectedEPRF = eprfData.find(e => e.id === selectedEPRF.id);
                setSelectedEPRF(updatedSelectedEPRF || (eprfData.length > 0 ? eprfData[0] : null));
            }
        } catch (error) {
            console.error("Failed to fetch patient data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [patientId]);
    
    useEffect(() => {
        // When selectedEPRF changes, reset to form view
        setView('form');
    }, [selectedEPRF])

    const handleGeneratePdf = () => {
        if (selectedEPRF && patient) {
            try {
                generateHandoverPdf(selectedEPRF, patient);
                showToast("PDF generated successfully.", "success");
            } catch (error) {
                console.error("PDF Generation Error:", error);
                showToast("Failed to generate PDF.", "error");
            }
        }
    };
    
    const handleApprove = async () => {
        if (!selectedEPRF || !user) return;
        setIsApproving(true);
        try {
            const reviewerName = `${user.firstName} ${user.lastName}`.trim();
            await approveEPRF(selectedEPRF.id!, selectedEPRF, { uid: user.uid, name: reviewerName });
            showToast("ePRF Approved!", "success");
            fetchData(); // Refresh data to show updated status
        } catch (error) {
            console.error("Failed to approve ePRF:", error);
            showToast("Could not approve ePRF.", "error");
        } finally {
            setIsApproving(false);
        }
    };
    
    const handleReturnToDraft = async (reason: string) => {
        if (!selectedEPRF || !user) return;
        setIsReturning(true);
        try {
             const managerName = `${user.firstName} ${user.lastName}`.trim();
             await returnEPRFToDraft(selectedEPRF.id!, selectedEPRF, { uid: user.uid, name: managerName }, reason);
             showToast("ePRF returned to creator.", "success");
             fetchData();
        } catch(e) {
            showToast("Failed to return ePRF.", "error");
        } finally {
            setIsReturning(false);
            setReturnModalOpen(false);
        }
    }


    if (loading && !patient) { // Only show full page loader on initial load
        return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /></div>;
    }

    if (!patient) {
        return <div className="text-center p-10 text-xl text-gray-600 dark:text-gray-300">Patient not found.</div>;
    }

    const getStatusChip = (status?: EPRFForm['status']) => {
        switch(status) {
            case 'Draft': return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Pending Review': return 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            case 'Reviewed': return 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200';
            default: return 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
        }
    };
    
    const viewButtonClasses = (buttonView: typeof view) => 
        `flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            view === buttonView 
            ? 'bg-ams-blue text-white shadow' 
            : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`;


    return (
        <div>
            <ReturnToDraftModal isOpen={isReturnModalOpen} onClose={() => setReturnModalOpen(false)} onConfirm={handleReturnToDraft} isLoading={isReturning} />
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">{patient.firstName} {patient.lastName}</h1>
                <div className="flex items-center gap-4 flex-wrap">
                    {isManager && selectedEPRF?.status === 'Pending Review' && (
                        <>
                        <button onClick={() => setReturnModalOpen(true)} disabled={isReturning} className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400">Return to Draft</button>
                        <button onClick={handleApprove} disabled={isApproving} className="flex items-center gap-2 px-4 py-2 bg-ams-light-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 min-w-[150px] justify-center">
                            {isApproving ? <SpinnerIcon className="w-5 h-5"/> : <><CheckIcon className="w-5 h-5"/>Approve ePRF</>}
                        </button>
                        </>
                    )}
                    <button
                        onClick={handleGeneratePdf}
                        disabled={!selectedEPRF || selectedEPRF.status === 'Draft'}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                        title={selectedEPRF?.status === 'Draft' ? "Cannot generate PDF for a draft" : "Generate Handover PDF"}
                    >
                        <PdfIcon className="w-5 h-5"/>
                        Generate PDF
                    </button>
                    <Link to="/patients" className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-opacity-90">
                        &larr; Patient List
                    </Link>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Demographics and Encounter List */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <DetailCard title="Demographics">
                        <p><strong>DOB:</strong> {patient.dob}</p>
                        <p><strong>Gender:</strong> {patient.gender}</p>
                        <p><strong>Address:</strong> {patient.address || 'N/A'}</p>
                    </DetailCard>
                     <DetailCard title="Clinical Background">
                        <p><strong>Allergies:</strong> {patient.allergies || 'None Known'}</p>
                        <p><strong>Medications:</strong> {patient.medications || 'None'}</p>
                        <p><strong>History:</strong> {patient.medicalHistory || 'None'}</p>
                    </DetailCard>
                    <DetailCard title="Past Encounters">
                         {eprfs.length > 0 ? (
                            <ul className="space-y-2">
                                {eprfs.map(eprf => (
                                    <li key={eprf.id}>
                                        <button
                                            onClick={() => setSelectedEPRF(eprf)}
                                            className={`w-full text-left p-3 rounded-md transition-colors ${selectedEPRF?.id === eprf.id ? 'bg-ams-light-blue text-white shadow' : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <p className={`font-semibold ${selectedEPRF?.id !== eprf.id && 'dark:text-gray-200'}`}>{eprf.incidentDate} - {eprf.incidentTime}</p>
                                                {eprf.status && (
                                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusChip(eprf.status)}`}>
                                                        {eprf.status}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-sm truncate ${selectedEPRF?.id !== eprf.id && 'dark:text-gray-400'}`}>{eprf.presentingComplaint}</p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                         ) : (
                            <p className="text-gray-500 dark:text-gray-400">No past ePRFs found.</p>
                         )}
                    </DetailCard>
                </div>
                
                {/* Right Column: Selected ePRF View */}
                <div className="lg:col-span-2">
                    {selectedEPRF ? (
                        <div>
                             <div className="mb-4 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm flex items-center gap-2">
                                <button className={viewButtonClasses('form')} onClick={() => setView('form')}>
                                    <FormIcon className="w-5 h-5" /> Form View
                                </button>
                                <button className={viewButtonClasses('timeline')} onClick={() => setView('timeline')}>
                                    <TimelineIcon className="w-5 h-5" /> Timeline
                                </button>
                                <button className={viewButtonClasses('audit')} onClick={() => setView('audit')}>
                                    <AuditIcon className="w-5 h-5" /> Audit Trail
                                </button>
                            </div>

                            {view === 'form' && <EPRFView eprf={selectedEPRF} />}
                            {view === 'timeline' && <ClinicalTimeline eprf={selectedEPRF} />}
                            {view === 'audit' && <AuditTrailView auditLog={selectedEPRF.auditLog || []} />}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 p-10 rounded-lg shadow text-center text-gray-500 dark:text-gray-400 h-full flex items-center justify-center">
                            <p>Select an encounter from the list to view details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PatientDetail;