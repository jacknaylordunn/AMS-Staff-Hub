import React from 'react';
import type { EPRFForm } from '../types';
import { getNews2RiskColor } from '../utils/news2Calculator';
import { DocsIcon } from './icons';

const ViewSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`mb-6 ${className}`}>
        <h4 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b-2 border-ams-blue/20 dark:border-ams-light-blue/20 pb-2 mb-3">{title}</h4>
        {children}
    </div>
);

const ViewField: React.FC<{ label: string; value?: string | number | null | string[]; className?: string }> = ({ label, value, className }) => (
    <div className={`mb-3 ${className}`}>
        <span className="block font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">{label}</span>
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-base">{Array.isArray(value) ? (value.length > 0 ? value.join(', ') : 'None specified') : (value || 'N/A')}</p>
    </div>
);

const EPRFView: React.FC<{ eprf: EPRFForm }> = ({ eprf }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-md max-h-[80vh] overflow-y-auto">
            <header className="flex flex-col sm:flex-row justify-between sm:items-center border-b-2 dark:border-gray-700 pb-4 mb-6">
                <div>
                    <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Patient Report</h3>
                    <p className="text-gray-500 dark:text-gray-400">Encounter Date: {eprf.incidentDate}</p>
                </div>
                <span className="mt-2 sm:mt-0 px-3 py-1 text-sm font-semibold rounded-full bg-ams-blue text-white dark:bg-ams-light-blue dark:text-ams-blue self-start">{eprf.presentationType}</span>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <ViewSection title="Patient & Incident">
                    <div className="grid grid-cols-2 gap-x-4">
                        <ViewField label="Patient Name" value={eprf.patientName} />
                        <ViewField label="Age" value={eprf.patientAge} />
                        <ViewField label="Gender" value={eprf.patientGender} />
                        <ViewField label="Incident #" value={eprf.incidentNumber} />
                        <ViewField label="Location" value={eprf.incidentLocation} className="col-span-2"/>
                        <ViewField label="Event" value={eprf.eventName} className="col-span-2"/>
                    </div>
                </ViewSection>
                 <ViewSection title="Timestamps">
                     <div className="grid grid-cols-2 gap-x-4">
                        <ViewField label="Time of Call" value={eprf.timeOfCall} />
                        <ViewField label="On Scene" value={eprf.onSceneTime} />
                        <ViewField label="At Patient" value={eprf.atPatientTime} />
                        <ViewField label="Left Scene" value={eprf.leftSceneTime} />
                        <ViewField label="At Destination" value={eprf.atDestinationTime} />
                        <ViewField label="Clear" value={eprf.clearDestinationTime} />
                    </div>
                </ViewSection>
            </div>

            {eprf.presentationType === 'Welfare/Intox' ? (
                 <ViewSection title="Welfare Log">
                    <ViewField label="Presenting Situation" value={eprf.presentingComplaint} />
                    {eprf.welfareLog?.length > 0 ? (
                        <table className="min-w-full text-sm mt-2">
                            <thead><tr className="text-left text-xs font-medium text-gray-600 dark:text-gray-400"><th className="p-2">Time</th><th className="p-2">Observation / Action</th></tr></thead>
                            <tbody className="dark:text-gray-300">{eprf.welfareLog.map((item, i) => <tr key={i} className="border-t dark:border-gray-700"><td className="p-2">{item.time}</td><td className="p-2">{item.observation}</td></tr>)}</tbody>
                        </table>
                    ) : <p className="text-gray-500 dark:text-gray-400">No welfare entries logged.</p>}
                 </ViewSection>
            ) : (
                <>
                    <ViewSection title="Clinical Narrative (SAMPLE)">
                        <ViewField label="Presenting Complaint" value={eprf.presentingComplaint} />
                        <ViewField label="History / Events" value={eprf.history} />
                        <ViewField label="Mechanism of Injury" value={eprf.mechanismOfInjury} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                            <ViewField label="Allergies" value={eprf.allergies} />
                            <ViewField label="Medications" value={eprf.medications} />
                        </div>
                        <ViewField label="Past Medical History" value={eprf.pastMedicalHistory} />
                    </ViewSection>
                    
                    {eprf.painAssessment && eprf.painAssessment.severity > 0 &&
                    <ViewSection title="Pain Assessment (OPQRST)">
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
                            <ViewField label="Onset" value={eprf.painAssessment.onset}/>
                            <ViewField label="Provocation" value={eprf.painAssessment.provocation}/>
                            <ViewField label="Quality" value={eprf.painAssessment.quality}/>
                            <ViewField label="Radiation" value={eprf.painAssessment.radiation}/>
                            <ViewField label="Time" value={eprf.painAssessment.time}/>
                            <ViewField label="Severity" value={`${eprf.painAssessment.severity}/10`}/>
                        </div>
                    </ViewSection>
                    }

                    {eprf.presentationType === 'Medical/Trauma' &&
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <ViewSection title="Primary Survey (ABCDE)">
                            <ViewField label="Airway" value={`${eprf.airwayDetails?.status || ''}. Adjuncts: ${eprf.airwayDetails?.adjuncts.join(', ') || 'None'}`} />
                            <ViewField label="Breathing" value={`Effort: ${eprf.breathingDetails?.effort || 'N/A'}. Sounds: ${eprf.breathingDetails?.sounds.join(', ') || 'N/A'} ${eprf.breathingDetails?.sides.join(', ') || ''}`} />
                            <ViewField label="Circulation" value={`Pulse: ${eprf.circulationDetails?.pulseQuality || 'N/A'}. Skin: ${eprf.circulationDetails?.skin || 'N/A'}`} />
                            <ViewField label="Exposure" value={eprf.exposure} />
                             <ViewField label="Airway Notes" value={eprf.airway} className="mt-2 border-t pt-2" />
                             <ViewField label="Breathing Notes" value={eprf.breathing} className="mt-2 border-t pt-2" />
                             <ViewField label="Circulation Notes" value={eprf.circulation} className="mt-2 border-t pt-2" />
                        </ViewSection>

                        <ViewSection title="Disability">
                            <div className="grid grid-cols-2 gap-x-4">
                                <ViewField label="AVPU" value={eprf.disability.avpu} />
                                <ViewField label="GCS Total" value={eprf.disability.gcs.total} />
                                <ViewField label="Blood Glucose" value={eprf.disability.bloodGlucoseLevel ? `${eprf.disability.bloodGlucoseLevel} mmol/L` : 'N/A'} />
                                <ViewField label="FAST Test" value={eprf.disability.fastTest ? `Face: ${eprf.disability.fastTest.face}, Arms: ${eprf.disability.fastTest.arms}, Speech: ${eprf.disability.fastTest.speech}` : 'N/A'} />
                            </div>
                            <ViewField label="GCS Breakdown" value={`E${eprf.disability.gcs.eyes} V${eprf.disability.gcs.verbal} M${eprf.disability.gcs.motor}`} />
                            <ViewField label="Pupils" value={eprf.disability.pupils} />
                        </ViewSection>
                    </div>
                    }
                    
                    <ViewSection title="Observations">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900"><tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"><th className="p-2">Time</th><th className="p-2">HR</th><th className="p-2">RR</th><th className="p-2">BP</th><th className="p-2">SpO2</th><th className="p-2">Temp</th><th className="p-2">BG</th><th className="p-2">Pain</th><th className="p-2">On O2?</th>{eprf.presentationType === 'Medical/Trauma' && <th className="p-2">NEWS2</th>}</tr></thead>
                                <tbody className="dark:text-gray-300">
                                    {eprf.vitals.map((v, i) => (
                                        <tr key={i} className="border-t dark:border-gray-700">
                                            <td className="p-2 font-semibold">{v.time}</td><td className="p-2">{v.hr}</td><td className="p-2">{v.rr}</td><td className="p-2">{v.bp}</td><td className="p-2">{v.spo2}%</td><td className="p-2">{v.temp}°C</td><td className="p-2">{v.bg}</td><td className="p-2">{v.painScore}</td><td className="p-2">{v.onOxygen ? 'Yes' : 'No'}</td>
                                            {eprf.presentationType === 'Medical/Trauma' && <td className="p-2"><span className={`px-2 py-0.5 font-bold rounded-full text-white text-xs ${getNews2RiskColor(v.news2)}`}>{v.news2 ?? 'N/A'}</span></td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ViewSection>

                     <ViewSection title="Secondary Survey & Injuries">
                        <ViewField label="Assessment Findings" value={eprf.secondarySurvey} />
                         {eprf.injuries?.length > 0 ? (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {eprf.injuries.map(injury => (
                                    <div key={injury.id} className="p-2 border rounded-md dark:border-gray-600 flex flex-col">
                                        {injury.drawingDataUrl && <img src={injury.drawingDataUrl} alt={injury.description} className="rounded-md bg-gray-200 dark:bg-gray-700 object-contain mb-2" />}
                                        <p className="font-semibold text-sm dark:text-gray-200 flex-grow">{injury.type}: <span className="font-normal">{injury.description}</span></p>
                                        <p className="text-xs text-gray-500 capitalize">{injury.view} view</p>
                                    </div>
                                ))}
                            </div>
                         ) : <p className="text-gray-500 dark:text-gray-400">No specific injuries logged.</p>}
                    </ViewSection>
                    
                    <ViewSection title="Treatment">
                        <ViewField label="Working Impressions" value={eprf.impressions} />
                        <ViewField label="Kit Items Used" value={eprf.itemsUsed} />
                        {eprf.medicationsAdministered?.length > 0 ?
                            <table className="w-full text-sm mt-4">
                                <thead><tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"><th className="p-2">Time</th><th className="p-2">Medication</th><th className="p-2">Dose</th><th className="p-2">Route</th></tr></thead>
                                <tbody className="dark:text-gray-300">{eprf.medicationsAdministered.map((m, i) => <tr key={i} className="border-t dark:border-gray-700"><td className="p-2">{m.time}</td><td className="p-2">{m.medication}</td><td className="p-2">{m.dose}</td><td className="p-2">{m.route}</td></tr>)}</tbody>
                            </table>
                            : <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No medications administered.</p>
                        }
                        {eprf.interventions?.length > 0 ?
                            <table className="w-full text-sm mt-4">
                                <thead><tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"><th className="p-2">Time</th><th className="p-2">Intervention</th><th className="p-2">Details</th></tr></thead>
                                <tbody className="dark:text-gray-300">{eprf.interventions.map((item, i) => <tr key={i} className="border-t dark:border-gray-700"><td className="p-2">{item.time}</td><td className="p-2">{item.intervention}</td><td className="p-2">{item.details}</td></tr>)}</tbody>
                            </table>
                            : <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No interventions performed.</p>
                        }
                    </ViewSection>
                 </>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <ViewSection title="Safeguarding">
                    <ViewField label="Concerns Raised" value={eprf.safeguarding?.concerns} />
                    <ViewField label="Details" value={eprf.safeguarding?.details} />
                </ViewSection>
                <ViewSection title="Mental Capacity">
                    <ViewField label="Assessment" value={eprf.mentalCapacity?.assessment} />
                    <ViewField label="Outcome" value={eprf.mentalCapacity?.outcome} />
                    <ViewField label="Details" value={eprf.mentalCapacity?.details} />
                </ViewSection>
            </div>


            {eprf.disposition === 'Left at Home (Against Advice)' && eprf.refusalOfCare &&
                <ViewSection title="Refusal of Care">
                    <ViewField label="Refused Treatment" value={eprf.refusalOfCare.refusedTreatment ? 'Yes' : 'No'} />
                    <ViewField label="Refused Transport" value={eprf.refusalOfCare.refusedTransport ? 'Yes' : 'No'} />
                    <ViewField label="Capacity Demonstrated" value={eprf.refusalOfCare.capacityDemonstrated ? 'Yes' : 'No'} />
                    <ViewField label="Risks Explained" value={eprf.refusalOfCare.risksExplained ? 'Yes' : 'No'} />
                    <ViewField label="Details" value={eprf.refusalOfCare.details} />
                </ViewSection>
            }

            <ViewSection title="Attachments">
                {eprf.attachments?.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {eprf.attachments.map(att => (
                            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block group">
                                {att.mimeType.startsWith('image/') ? (
                                    <img src={att.url} alt={att.description || 'Attachment'} className="rounded-lg w-full h-32 object-cover transition-transform group-hover:scale-105" />
                                ) : (
                                    <div className="rounded-lg w-full h-32 bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center p-2">
                                        <DocsIcon className="w-8 h-8 text-gray-400" />
                                        <p className="text-xs text-center text-gray-500 dark:text-gray-300 mt-2 truncate">{att.fileName}</p>
                                    </div>
                                )}
                                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400 truncate">{att.description || att.fileName}</p>
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">No files attached.</p>
                )}
            </ViewSection>
            

             <ViewSection title="Disposition & Handover" className="pt-4 border-t-2 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <ViewField label="Final Disposition" value={eprf.disposition} />
                    {eprf.disposition === 'Conveyed to ED' && <ViewField label="Destination" value={eprf.dispositionDetails.destination} />}
                    {eprf.disposition === 'Conveyed to ED' && <ViewField label="Receiving Clinician" value={eprf.dispositionDetails.receivingClinician} />}
                </div>
                {eprf.disposition === 'Referred to Other Service' && <ViewField label="Referral Details" value={eprf.dispositionDetails.referralDetails} />}
                <ViewField label="Handover Notes" value={eprf.handoverDetails} />
            </ViewSection>

             <ViewSection title="Signatures & Crew">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                        <ViewField label="Attending Crew" value={eprf.crewMembers.map(c => c.name).join(', ')} />
                        <ViewField label="Report Author" value={eprf.createdBy.name} />
                         {eprf.reviewedBy && <ViewField label="Reviewed By" value={`${eprf.reviewedBy.name} on ${eprf.reviewedBy.date.toDate().toLocaleDateString()}`} />}
                    </div>
                    {(eprf.clinicianSignatureUrl || eprf.patientSignatureUrl) && (
                        <div className="grid grid-cols-2 gap-4">
                            {eprf.clinicianSignatureUrl && (
                                <div>
                                    <span className="block font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Clinician</span>
                                    <img src={eprf.clinicianSignatureUrl} alt="Clinician Signature" className="border rounded-md bg-gray-50 dark:border-gray-600" />
                                </div>
                            )}
                            {eprf.patientSignatureUrl && (
                                <div>
                                    <span className="block font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Patient/Guardian</span>
                                    <img src={eprf.patientSignatureUrl} alt="Patient Signature" className="border rounded-md bg-gray-50 dark:border-gray-600" />
                                </div>
                            )}
                        </div>
                    )}
                 </div>
            </ViewSection>

        </div>
    );
};

export default EPRFView;
