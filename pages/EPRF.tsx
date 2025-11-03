
import React, { useState, useMemo, useEffect } from 'react';
import type { EPRFForm, VitalSign, Patient } from '../types';
import { PlusIcon, TrashIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

const mockPatients: Patient[] = [
    { id: '1', firstName: 'John', lastName: 'Smith', dob: '1985-05-15', gender: 'Male', address: '123 Fake St, Anytown', allergies: 'Penicillin', medications: 'Aspirin', medicalHistory: 'Hypertension' },
    { id: '2', firstName: 'Jane', lastName: 'Doe', dob: '1992-09-20', gender: 'Female', address: '456 Main Ave, Othertown', allergies: 'None', medications: 'None', medicalHistory: 'Asthma' },
];

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`bg-white p-6 rounded-lg shadow mb-6 ${className}`}>
    <h2 className="text-xl font-bold text-ams-blue border-b pb-2 mb-4">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </div>
);

const FieldWrapper: React.FC<{ children: React.ReactNode, className?: string}> = ({children, className}) => <div className={className}>{children}</div>;
const InputField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean }> = 
({ label, name, value, onChange, type = 'text', required = false }) => (
  <FieldWrapper>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <input type={type} id={name} name={name} value={value} onChange={onChange} required={required} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm" />
  </FieldWrapper>
);
const SelectField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }> = 
({ label, name, value, onChange, children }) => (
    <FieldWrapper>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <select id={name} name={name} value={value} onChange={onChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm">
            {children}
        </select>
    </FieldWrapper>
);
const TextAreaField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number; className?: string }> = 
({ label, name, value, onChange, rows = 3, className = "md:col-span-2 lg:col-span-3" }) => (
  <FieldWrapper className={className}>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <textarea id={name} name={name} value={value} onChange={onChange} rows={rows} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm" />
  </FieldWrapper>
);

const EPRF: React.FC = () => {
    const { user } = useAuth();
    const [formState, setFormState] = useState<EPRFForm>({
        patientId: null,
        eventId: null,
        incidentNumber: `AMS-${Date.now()}`,
        incidentDate: new Date().toISOString().split('T')[0],
        incidentTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
        incidentLocation: '',
        patientName: '',
        patientAge: '',
        patientGender: 'Unknown',
        presentingComplaint: '',
        history: '',
        allergies: '',
        medications: '',
        pastMedicalHistory: '',
        airway: '',
        breathing: '',
        circulation: '',
        disability: { avpu: 'Alert', gcs: { eyes: 4, verbal: 5, motor: 6, total: 15 }, pupils: ''},
        exposure: '',
        vitals: [{ time: new Date().toTimeString().split(' ')[0].substring(0, 5), hr: '', rr: '', bp: '', spo2: '', gcs: '15', temp: '', bg: '' }],
        secondarySurvey: '',
        treatment: '',
        disposal: '',
        handoverDetails: '',
        crewMembers: user ? [{ uid: user.uid, name: user.displayName || user.email! }] : [],
    });

    const [patientSearch, setPatientSearch] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

    const searchResults = useMemo(() => {
        if (!patientSearch) return [];
        return mockPatients.filter(p =>
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase()) ||
            p.dob.includes(patientSearch)
        );
    }, [patientSearch]);

    useEffect(() => {
        const { eyes, verbal, motor } = formState.disability.gcs;
        const total = eyes + verbal + motor;
        if(total !== formState.disability.gcs.total){
             setFormState(prev => ({ ...prev, disability: { ...prev.disability, gcs: { ...prev.disability.gcs, total } } }));
        }
    }, [formState.disability.gcs.eyes, formState.disability.gcs.verbal, formState.disability.gcs.motor]);

    const handleSelectPatient = (patient: Patient) => {
        setSelectedPatient(patient);
        setPatientSearch('');
        const age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
        setFormState(prev => ({
            ...prev,
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientAge: age.toString(),
            patientGender: patient.gender,
            allergies: patient.allergies,
            medications: patient.medications,
            pastMedicalHistory: patient.medicalHistory,
        }));
    };
    
    const handleCreateNewPatient = () => {
        setSelectedPatient(null);
        setPatientSearch('');
        setFormState(prev => ({ ...prev, patientId: 'new', patientName: '', patientAge: '', patientGender: 'Unknown', allergies: '', medications: '', pastMedicalHistory: '' }));
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prevState => ({ ...prevState, [name]: value }));
    };
    
    const handleGCSChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, disability: { ...prev.disability, gcs: { ...prev.disability.gcs, [name]: parseInt(value, 10) } }}));
    };
    
    const handleVitalChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newVitals = [...formState.vitals];
        newVitals[index] = { ...newVitals[index], [name]: value };
        setFormState(prevState => ({ ...prevState, vitals: newVitals }));
    };

    const addVitalSign = () => setFormState(prevState => ({ ...prevState, vitals: [...prevState.vitals, { time: new Date().toTimeString().split(' ')[0].substring(0, 5), hr: '', rr: '', bp: '', spo2: '', gcs: '', temp: '', bg: '' }]}));
    const removeVitalSign = (index: number) => setFormState(prevState => ({ ...prevState, vitals: formState.vitals.filter((_, i) => i !== index) }));

    const handleSave = () => {
        console.log("ePRF FINAL STATE:", formState);
        alert("ePRF saved to console. This would normally save to the database. You can now print the form.");
        window.print();
    };

    return (
        <div className="eprf-form-container">
            <style>{`@media print { body * { visibility: hidden; } .eprf-form-container, .eprf-form-container * { visibility: visible; } .eprf-form-container { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none; } }`}</style>
            <form onSubmit={(e) => e.preventDefault()}>
                <Section title="Patient Selection" className="no-print">
                   <FieldWrapper className="lg:col-span-2">
                     <label htmlFor="patientSearch" className="block text-sm font-medium text-gray-700">Search Existing Patient (Name or DOB YYYY-MM-DD)</label>
                     <input type="text" id="patientSearch" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                     {searchResults.length > 0 && (
                         <ul className="border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto">
                             {searchResults.map(p => <li key={p.id} onClick={() => handleSelectPatient(p)} className="p-2 hover:bg-ams-light-blue hover:text-white cursor-pointer">{p.firstName} {p.lastName} - {p.dob}</li>)}
                         </ul>
                     )}
                   </FieldWrapper>
                   <FieldWrapper>
                     <label className="block text-sm font-medium text-gray-700 invisible">New Patient</label>
                     <button type="button" onClick={handleCreateNewPatient} className="mt-1 w-full px-4 py-2 font-semibold text-white bg-ams-blue rounded-md hover:bg-opacity-90">Create New Patient</button>
                   </FieldWrapper>
                </Section>
                
                <Section title="Incident & Patient Details">
                    <InputField label="Incident Number" name="incidentNumber" value={formState.incidentNumber} onChange={handleChange} required />
                    <InputField label="Date" name="incidentDate" type="date" value={formState.incidentDate} onChange={handleChange} required />
                    <InputField label="Time" name="incidentTime" type="time" value={formState.incidentTime} onChange={handleChange} required />
                    <InputField label="Location" name="incidentLocation" value={formState.incidentLocation} onChange={handleChange} required />
                    <InputField label="Full Name" name="patientName" value={formState.patientName} onChange={handleChange} required />
                    <InputField label="Age" name="patientAge" value={formState.patientAge} onChange={handleChange} />
                    <SelectField label="Gender" name="patientGender" value={formState.patientGender} onChange={handleChange}><option>Unknown</option><option>Male</option><option>Female</option><option>Other</option></SelectField>
                </Section>
                
                <Section title="Clinical Information (History & Complaint)">
                    <TextAreaField label="Presenting Complaint" name="presentingComplaint" value={formState.presentingComplaint} onChange={handleChange} />
                    <TextAreaField label="History of Complaint / Events" name="history" value={formState.history} onChange={handleChange} />
                     <TextAreaField label="Mechanism of Injury (if applicable)" name="mechanismOfInjury" value={formState.mechanismOfInjury || ''} onChange={handleChange} />
                </Section>

                <Section title="SAMPLE History">
                    <InputField label="Allergies" name="allergies" value={formState.allergies} onChange={handleChange} />
                    <InputField label="Medications" name="medications" value={formState.medications} onChange={handleChange} />
                    <TextAreaField label="Past Medical History" name="pastMedicalHistory" value={formState.pastMedicalHistory} onChange={handleChange} />
                </Section>

                <Section title="Primary Survey (ABCDE)">
                    <TextAreaField label="A - Airway" name="airway" value={formState.airway} onChange={handleChange} />
                    <TextAreaField label="B - Breathing" name="breathing" value={formState.breathing} onChange={handleChange} />
                    <TextAreaField label="C - Circulation" name="circulation" value={formState.circulation} onChange={handleChange} />
                    <TextAreaField label="E - Exposure & Environment" name="exposure" value={formState.exposure} onChange={handleChange} />
                </Section>
                
                <Section title="D - Disability">
                    <SelectField label="AVPU" name="avpu" value={formState.disability.avpu} onChange={e => setFormState(p => ({...p, disability: {...p.disability, avpu: e.target.value as any}}))}>
                        <option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option>
                    </SelectField>
                    <SelectField label="GCS - Eyes" name="eyes" value={formState.disability.gcs.eyes} onChange={handleGCSChange}>
                        {[4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
                    </SelectField>
                    <SelectField label="GCS - Verbal" name="verbal" value={formState.disability.gcs.verbal} onChange={handleGCSChange}>
                        {[5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
                    </SelectField>
                     <SelectField label="GCS - Motor" name="motor" value={formState.disability.gcs.motor} onChange={handleGCSChange}>
                        {[6,5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
                    </SelectField>
                     <InputField label="GCS Total" name="gcsTotal" value={formState.disability.gcs.total} onChange={() => {}} />
                     <InputField label="Pupils" name="pupils" value={formState.disability.pupils} onChange={e => setFormState(p => ({...p, disability: {...p.disability, pupils: e.target.value}}))}/>
                </Section>
                
                <div className="bg-white p-6 rounded-lg shadow mb-6">
                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                        <h2 className="text-xl font-bold text-ams-blue">Vital Signs / Observations</h2>
                        <button type="button" onClick={addVitalSign} className="no-print flex items-center px-3 py-1 bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/> Add Row</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead><tr className="text-left text-sm font-medium text-gray-600"><th className="p-2">Time</th><th className="p-2">HR</th><th className="p-2">RR</th><th className="p-2">BP</th><th className="p-2">SpO2</th><th className="p-2">GCS</th><th className="p-2">Temp</th><th className="p-2">BG</th><th className="p-2">NEWS2</th><th className="p-2 no-print"></th></tr></thead>
                            <tbody>
                                {formState.vitals.map((vital, index) => (
                                    <tr key={index} className="border-t">
                                        <td><input type="time" name="time" value={vital.time} onChange={(e) => handleVitalChange(index, e)} className="w-24 p-1 border rounded-md"/></td>
                                        <td><input name="hr" value={vital.hr} onChange={(e) => handleVitalChange(index, e)} className="w-16 p-1 border rounded-md"/></td>
                                        <td><input name="rr" value={vital.rr} onChange={(e) => handleVitalChange(index, e)} className="w-16 p-1 border rounded-md"/></td>
                                        <td><input name="bp" value={vital.bp} onChange={(e) => handleVitalChange(index, e)} className="w-20 p-1 border rounded-md"/></td>
                                        <td><input name="spo2" value={vital.spo2} onChange={(e) => handleVitalChange(index, e)} className="w-16 p-1 border rounded-md"/></td>
                                        <td><input name="gcs" value={vital.gcs} onChange={(e) => handleVitalChange(index, e)} className="w-16 p-1 border rounded-md"/></td>
                                        <td><input name="temp" value={vital.temp} onChange={(e) => handleVitalChange(index, e)} className="w-16 p-1 border rounded-md"/></td>
                                        <td><input name="bg" value={vital.bg} onChange={(e) => handleVitalChange(index, e)} className="w-16 p-1 border rounded-md"/></td>
                                        <td><input name="news2" value={vital.news2 || ''} onChange={(e) => handleVitalChange(index, e)} className="w-16 p-1 border rounded-md" placeholder="Score"/></td>
                                        <td className="no-print">{formState.vitals.length > 1 && <button type="button" onClick={() => removeVitalSign(index)}><TrashIcon className="w-5 h-5 text-red-500 hover:text-red-700"/></button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Section title="Secondary Survey / Further Examination">
                    <TextAreaField label="Head-to-toe assessment findings and other examination details." name="secondarySurvey" value={formState.secondarySurvey} onChange={handleChange} rows={6} />
                </Section>
                
                <Section title="Treatment, Disposal & Handover">
                    <TextAreaField label="Treatment Given / Management Plan" name="treatment" value={formState.treatment} onChange={handleChange} />
                    <TextAreaField label="Disposal (e.g., Hospital, Home, Police)" name="disposal" value={formState.disposal} onChange={handleChange} />
                     <TextAreaField label="Handover Details (Crew name/number, facility, etc.)" name="handoverDetails" value={formState.handoverDetails} onChange={handleChange} />
                </Section>
                
                <div className="flex justify-end mt-8 no-print">
                    <button type="button" onClick={handleSave} className="px-6 py-3 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90">
                        Save and Print ePRF
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EPRF;
