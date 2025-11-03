import React from 'react';
import type { EPRFForm } from '../types';
import { getNews2RiskColor } from '../utils/news2Calculator';

const ViewSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`mb-4 ${className}`}>
        <h4 className="text-md font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-1 mb-2">{title}</h4>
        {children}
    </div>
);

const ViewField: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
    <div className="mb-2">
        <span className="font-semibold text-gray-600 dark:text-gray-400 text-sm">{label}:</span>
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{value || 'N/A'}</p>
    </div>
);

const EPRFView: React.FC<{ eprf: EPRFForm }> = ({ eprf }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Encounter: {eprf.incidentDate} at {eprf.incidentTime}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <ViewSection title="Incident Details">
                    <ViewField label="Incident #" value={eprf.incidentNumber} />
                    <ViewField label="Location" value={eprf.incidentLocation} />
                </ViewSection>

                <ViewSection title="Patient Details">
                    <ViewField label="Name" value={eprf.patientName} />
                    <ViewField label="Age" value={eprf.patientAge} />
                    <ViewField label="Gender" value={eprf.patientGender} />
                </ViewSection>
            </div>

            <ViewSection title="Clinical Information">
                <ViewField label="Presenting Complaint" value={eprf.presentingComplaint} />
                <ViewField label="History / Events" value={eprf.history} />
                <ViewField label="Mechanism of Injury" value={eprf.mechanismOfInjury} />
            </ViewSection>
            
            <ViewSection title="SAMPLE History">
                <ViewField label="Allergies" value={eprf.allergies} />
                <ViewField label="Medications" value={eprf.medications} />
                <ViewField label="Past Medical History" value={eprf.pastMedicalHistory} />
            </ViewSection>

            <ViewSection title="Primary Survey (ABCDE)">
                <ViewField label="Airway" value={eprf.airway} />
                <ViewField label="Breathing" value={eprf.breathing} />
                <ViewField label="Circulation" value={eprf.circulation} />
                <ViewField label="Exposure" value={eprf.exposure} />
            </ViewSection>

            <ViewSection title="Disability">
                <ViewField label="AVPU" value={eprf.disability.avpu} />
                <ViewField label="GCS" value={`E${eprf.disability.gcs.eyes} V${eprf.disability.gcs.verbal} M${eprf.disability.gcs.motor} (Total: ${eprf.disability.gcs.total})`} />
                <ViewField label="Pupils" value={eprf.disability.pupils} />
            </ViewSection>
            
            <ViewSection title="Observations">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead><tr className="text-left text-xs font-medium text-gray-600 dark:text-gray-400"><th className="p-1">Time</th><th className="p-1">HR</th><th className="p-1">RR</th><th className="p-1">BP</th><th className="p-1">SpO2</th><th className="p-1">Temp</th><th className="p-1">BG</th><th className="p-1">Pain</th><th className="p-1">On O2?</th><th className="p-1">NEWS2</th></tr></thead>
                        <tbody className="dark:text-gray-300">
                            {eprf.vitals.map((v, i) => (
                                <tr key={i} className="border-t dark:border-gray-700">
                                    <td className="p-1">{v.time}</td><td className="p-1">{v.hr}</td><td className="p-1">{v.rr}</td><td className="p-1">{v.bp}</td><td className="p-1">{v.spo2}</td><td className="p-1">{v.temp}</td><td className="p-1">{v.bg}</td><td className="p-1">{v.painScore}</td><td className="p-1">{v.onOxygen ? 'Yes' : 'No'}</td>
                                    <td className="p-1"><span className={`px-2 py-0.5 font-bold rounded-full text-white text-xs ${getNews2RiskColor(v.news2)}`}>{v.news2 ?? 'N/A'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ViewSection>

             <ViewSection title="Secondary Survey & Injuries">
                <ViewField label="Assessment Findings" value={eprf.secondarySurvey} />
                 {eprf.injuries?.length > 0 ? (
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        {eprf.injuries.map(injury => (
                            <li key={injury.id} className="dark:text-gray-300">
                                <span className="font-semibold">{injury.location}:</span> {injury.description}
                            </li>
                        ))}
                    </ul>
                 ) : <p className="text-gray-500 dark:text-gray-400">No specific injuries logged.</p>}
            </ViewSection>
            
            <ViewSection title="Medications Administered">
                {eprf.medicationsAdministered?.length > 0 ? (
                    <table className="min-w-full text-sm">
                        <thead><tr className="text-left text-xs font-medium text-gray-600 dark:text-gray-400"><th className="p-1">Time</th><th className="p-1">Medication</th><th className="p-1">Dose</th><th className="p-1">Route</th></tr></thead>
                        <tbody className="dark:text-gray-300">{eprf.medicationsAdministered.map((m, i) => <tr key={i} className="border-t dark:border-gray-700"><td className="p-1">{m.time}</td><td className="p-1">{m.medication}</td><td className="p-1">{m.dose}</td><td className="p-1">{m.route}</td></tr>)}</tbody>
                    </table>
                ) : <p className="text-gray-500 dark:text-gray-400">None administered.</p>}
            </ViewSection>

            <ViewSection title="Interventions">
                 {eprf.interventions?.length > 0 ? (
                    <table className="min-w-full text-sm">
                        <thead><tr className="text-left text-xs font-medium text-gray-600 dark:text-gray-400"><th className="p-1">Time</th><th className="p-1">Intervention</th><th className="p-1">Details</th></tr></thead>
                        <tbody className="dark:text-gray-300">{eprf.interventions.map((item, i) => <tr key={i} className="border-t dark:border-gray-700"><td className="p-1">{item.time}</td><td className="p-1">{item.intervention}</td><td className="p-1">{item.details}</td></tr>)}</tbody>
                    </table>
                 ) : <p className="text-gray-500 dark:text-gray-400">None performed.</p>}
            </ViewSection>

             <ViewSection title="Disposal & Handover">
                <ViewField label="Disposal Plan" value={eprf.disposal} />
                <ViewField label="Handover Details" value={eprf.handoverDetails} />
            </ViewSection>
        </div>
    );
};

export default EPRFView;