
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPatientById } from '../services/patientService';
import { getEPRFsForPatient, approveEPRF, returnEPRFToDraft } from '../services/eprfService';
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
    // FIX: Completed the line to call the useAuth hook.
    const { user, isManager } = useAuth();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [eprfs, setEprfs] = useState<EPRFForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEPRF, setSelectedEPRF] = useState<EPRFForm | null>(null);
    const [viewMode, setViewMode] = useState<'form' | 'timeline' | 'audit'>('form');
    
    // modals state
    const [isReturnModalOpen, setReturnModalOpen] = useState(false);
    const [isApproveModalOpen, setApproveModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!patientId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [patientData, eprfsData] = await Promise.all([
                    getPatientById(patientId),
                    getEPRFsForPatient(patientId)
                ]);
                setPatient(patientData);
                setEprfs(eprfsData);
                if (eprfsData.length > 0) {
                    setSelectedEPRF(eprfsData[0]);
                }
            } catch (error) {
                console.error("Failed to load patient details:", error);
                showToast("Could not load patient details.", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [patientId]);
    
    const handleGeneratePdf = (eprf: EPRFForm) => {
        if (patient) {
            generateHandoverPdf(eprf, patient);
        }
    };
    
    const handleApprove = async () => {
        if (!selectedEPRF || !user) return;
        setIsProcessing(true);
        try {
            await approveEPRF(selectedEPRF.id!, selectedEPRF, { uid: user.uid, name: `${user.firstName} ${user.lastName}`.trim() });
            showToast("ePRF Approved.", "success");
            setEprfs(prev => prev.map(e => e.id === selectedEPRF.id ? { ...e, status: 'Reviewed', reviewNotes: undefined } : e));
            setSelectedEPRF(prev => prev ? { ...prev, status: 'Reviewed', reviewNotes: undefined } : null);
        } catch (error) {
            showToast("Failed to approve ePRF.", "error");
        } finally {
            setIsProcessing(false);
            setApproveModalOpen(false);
        }
    };
    
    const handleReturnToDraft = async (reason: string) => {
        if (!selectedEPRF || !user) return;
        setIsProcessing(true);
        try {
            await returnEPRFToDraft(selectedEPRF.id!, selectedEPRF, { uid: user.uid, name: `${user.firstName} ${user.lastName}`.trim() }, reason);
            showToast("ePRF returned to draft.", "success");
            setEprfs(prev => prev.map(e => e.id === selectedEPRF.id ? { ...e, status: 'Draft', reviewNotes: reason } : e));
            setSelectedEPRF(prev => prev ? { ...prev, status: 'Draft', reviewNotes: reason } : null);
        } catch (error) {
            showToast("Failed to return ePRF.", "error");
        } finally {
            setIsProcessing(false);
            setReturnModalOpen(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /></div>;
    }

    if (!patient) {
        return <div className="text-center p-10 text-xl text-gray-600 dark:text-gray-300">Patient not found.</div>;
    }

    const getStatusChip = (status?: EPRFForm['status']) => {
        switch(status) {
            case 'Reviewed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'Pending Review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
            default: return '';
        }
    };

    return (
        <div>
            <ConfirmationModal isOpen={isApproveModalOpen} onClose={() => setApproveModalOpen(false)} onConfirm={handleApprove} title="Approve ePRF" message="Are you sure you want to approve this ePRF? This will mark it as complete and lock it from further edits." confirmText="Approve" isLoading={isProcessing}/>
            <ReturnToDraftModal isOpen={isReturnModalOpen} onClose={() => setReturnModalOpen(false)} onConfirm={handleReturnToDraft} isLoading={isProcessing}/>
            
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-2">{patient.firstName} {patient.lastName}</h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">{patient.dob} ({new Date().getFullYear() - new Date(patient.dob).getFullYear()} years) - {patient.gender}</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <DetailCard title="Contact & Demographics">
                        <p><strong>NHS Number:</strong> {patient.nhsNumber || 'Not provided'}</p>
                        <p><strong>Address:</strong> {patient.address || 'Not provided'}</p>
                    </DetailCard>
                     <DetailCard title="Medical Information">
                        <p><strong>Allergies:</strong> {patient.allergies || 'None known'}</p>
                        <p><strong>Medications:</strong> {patient.medications || 'None'}</p>
                         <p><strong>History:</strong> {patient.medicalHistory || 'None'}</p>
                    </DetailCard>

                     <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Care Encounters</h3>
                         {eprfs.length > 0 ? (
                            <ul className="space-y-2">
                                {eprfs.map(eprf => (
                                    <li key={eprf.id}>
                                        <button onClick={() => setSelectedEPRF(eprf)} className={`w-full text-left p-3 rounded-md transition-colors ${selectedEPRF?.id === eprf.id ? 'bg-ams-light-blue text-white' : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                                            <p className="font-semibold">{eprf.incidentDate} at {eprf.eventName}</p>
                                            <p className="text-sm truncate">{eprf.presentingComplaint}</p>
                                            <span className={`mt-1 inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusChip(eprf.status)}`}>{eprf.status}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                         ) : <p className="text-gray-500 dark:text-gray-400">No care encounters found for this patient.</p>}
                    </div>

                </div>
                <div className="lg:col-span-2">
                    {selectedEPRF ? (
                        <div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4 flex flex-wrap justify-between items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setViewMode('form')} className={`flex items-center gap-2 p-2 rounded-md ${viewMode === 'form' ? 'bg-ams-blue text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}><FormIcon className="w-5 h-5"/> View Form</button>
                                        <button onClick={() => setViewMode('timeline')} className={`flex items-center gap-2 p-2 rounded-md ${viewMode === 'timeline' ? 'bg-ams-blue text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}><TimelineIcon className="w-5 h-5"/> Timeline</button>
                                        <button onClick={() => setViewMode('audit')} className={`flex items-center gap-2 p-2 rounded-md ${viewMode === 'audit' ? 'bg-ams-blue text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}><AuditIcon className="w-5 h-5"/> Audit</button>
                                        <button onClick={() => handleGeneratePdf(selectedEPRF)} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><PdfIcon className="w-5 h-5"/> PDF</button>
                                    </div>
                                    {isManager && selectedEPRF.status === 'Pending Review' && (
                                        <div className="flex gap-2 mt-4">
                                            <button onClick={() => setReturnModalOpen(true)} className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-md hover:bg-orange-600">Return to Draft</button>
                                            <button onClick={() => setApproveModalOpen(true)} className="px-4 py-2 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600 flex items-center"><CheckIcon className="w-5 h-5 mr-1"/> Approve</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                             {selectedEPRF.reviewNotes && (
                                <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md dark:bg-yellow-900 dark:text-yellow-200">
                                    <p><span className="font-bold">Manager's Note:</span> {selectedEPRF.reviewNotes}</p>
                                </div>
                            )}
                            {viewMode === 'form' && <EPRFView eprf={selectedEPRF} />}
                            {viewMode === 'timeline' && <ClinicalTimeline eprf={selectedEPRF} />}
                            {viewMode === 'audit' && <AuditTrailView auditLog={selectedEPRF.auditLog} />}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                            <p className="text-gray-500 dark:text-gray-400">Select a care encounter to view details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PatientDetail;
