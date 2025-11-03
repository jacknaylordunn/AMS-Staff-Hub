import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPatientById, getEPRFsForPatient, approveEPRF } from '../services/firestoreService';
import type { Patient, EPRFForm } from '../types';
import { SpinnerIcon, PdfIcon, CheckIcon } from '../components/icons';
import EPRFView from '../components/EPRFView';
import { generateHandoverPdf } from '../utils/pdfGenerator';
import { showToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';

const DetailCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">{title}</h3>
        <div className="space-y-2 text-gray-700 dark:text-gray-300">{children}</div>
    </div>
);

const PatientDetail: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const { user, isManager } = useAuth();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [eprfs, setEprfs] = useState<EPRFForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEPRF, setSelectedEPRF] = useState<EPRFForm | null>(null);
    const [isApproving, setIsApproving] = useState(false);

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
            await approveEPRF(selectedEPRF.id!, { uid: user.uid, name: user.displayName || user.email! });
            showToast("ePRF Approved!", "success");
            fetchData(); // Refresh data to show updated status
        } catch (error) {
            console.error("Failed to approve ePRF:", error);
            showToast("Could not approve ePRF.", "error");
        } finally {
            setIsApproving(false);
        }
    };


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
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">{patient.firstName} {patient.lastName}</h1>
                <div className="flex items-center gap-4 flex-wrap">
                    {isManager && selectedEPRF?.status === 'Pending Review' && (
                        <button onClick={handleApprove} disabled={isApproving} className="flex items-center gap-2 px-4 py-2 bg-ams-light-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 min-w-[150px] justify-center">
                            {isApproving ? <SpinnerIcon className="w-5 h-5"/> : <><CheckIcon className="w-5 h-5"/>Approve ePRF</>}
                        </button>
                    )}
                    <button
                        onClick={handleGeneratePdf}
                        disabled={!selectedEPRF || selectedEPRF.status === 'Draft'}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                        title={selectedEPRF?.status === 'Draft' ? "Cannot generate PDF for a draft" : "Generate Handover PDF"}
                    >
                        <PdfIcon className="w-5 h-5"/>
                        Generate Handover PDF
                    </button>
                    <Link to="/patients" className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90">
                        &larr; Back to Patient List
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
                        <EPRFView eprf={selectedEPRF} />
                    ) : (
                        <div className="bg-white dark:bg-gray-800 p-10 rounded-lg shadow text-center text-gray-500 dark:text-gray-400">
                            <p>Select an encounter from the list to view details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PatientDetail;