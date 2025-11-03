
import React, { useState } from 'react';
import type { EPRFForm, VitalSign } from '../types';
import { PlusIcon, TrashIcon } from '../components/icons';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white p-6 rounded-lg shadow mb-6">
    <h2 className="text-xl font-bold text-ams-blue border-b pb-2 mb-4">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </div>
);

const InputField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean }> = 
({ label, name, value, onChange, type = 'text', required = false }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <input type={type} id={name} name={name} value={value} onChange={onChange} required={required} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm" />
  </div>
);

const SelectField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }> = 
({ label, name, value, onChange, children }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <select id={name} name={name} value={value} onChange={onChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm">
            {children}
        </select>
    </div>
);

const TextAreaField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number }> = 
({ label, name, value, onChange, rows = 3 }) => (
  <div className="md:col-span-2 lg:col-span-3">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <textarea id={name} name={name} value={value} onChange={onChange} rows={rows} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm" />
  </div>
);

const EPRF: React.FC = () => {
    const [formState, setFormState] = useState<EPRFForm>({
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
        airway: '',
        breathing: '',
        circulation: '',
        disability: '',
        exposure: '',
        vitals: [{ time: new Date().toTimeString().split(' ')[0].substring(0, 5), hr: '', rr: '', bp: '', spo2: '', gcs: '', temp: '', bg: '' }],
        treatment: '',
        disposal: '',
        crewMembers: [],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prevState => ({ ...prevState, [name]: value }));
    };

    const handleVitalChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newVitals = [...formState.vitals];
        newVitals[index] = { ...newVitals[index], [name]: value };
        setFormState(prevState => ({ ...prevState, vitals: newVitals }));
    };

    const addVitalSign = () => {
        setFormState(prevState => ({
            ...prevState,
            vitals: [...prevState.vitals, { time: new Date().toTimeString().split(' ')[0].substring(0, 5), hr: '', rr: '', bp: '', spo2: '', gcs: '', temp: '', bg: '' }]
        }));
    };

    const removeVitalSign = (index: number) => {
        const newVitals = formState.vitals.filter((_, i) => i !== index);
        setFormState(prevState => ({ ...prevState, vitals: newVitals }));
    };
    
    const handleSave = () => {
        alert("This form will be prepared for printing. Please save as PDF and upload to the company Google Drive folder. Direct saving is not supported for security reasons.");
        window.print();
    };

    return (
        <div className="eprf-form-container">
            <style>
                {`
                    @media print {
                        body * { visibility: hidden; }
                        .eprf-form-container, .eprf-form-container * { visibility: visible; }
                        .eprf-form-container { position: absolute; left: 0; top: 0; width: 100%; }
                        .no-print { display: none; }
                    }
                `}
            </style>
            <form onSubmit={(e) => e.preventDefault()}>
                <Section title="Incident Details">
                    <InputField label="Incident Number" name="incidentNumber" value={formState.incidentNumber} onChange={handleChange} required />
                    <InputField label="Date" name="incidentDate" type="date" value={formState.incidentDate} onChange={handleChange} required />
                    <InputField label="Time" name="incidentTime" type="time" value={formState.incidentTime} onChange={handleChange} required />
                    <InputField label="Location" name="incidentLocation" value={formState.incidentLocation} onChange={handleChange} required />
                </Section>
                
                <Section title="Patient Demographics">
                    <InputField label="Full Name" name="patientName" value={formState.patientName} onChange={handleChange} required />
                    <InputField label="Age" name="patientAge" value={formState.patientAge} onChange={handleChange} />
                    <SelectField label="Gender" name="patientGender" value={formState.patientGender} onChange={handleChange}>
                        <option>Unknown</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                    </SelectField>
                </Section>
                
                <Section title="Clinical Information (SAMPLE)">
                    <TextAreaField label="Presenting Complaint" name="presentingComplaint" value={formState.presentingComplaint} onChange={handleChange} />
                    <TextAreaField label="History of Complaint / Events" name="history" value={formState.history} onChange={handleChange} />
                    <InputField label="Allergies" name="allergies" value={formState.allergies} onChange={handleChange} />
                    <InputField label="Medications" name="medications" value={formState.medications} onChange={handleChange} />
                </Section>

                <Section title="Primary Survey (ABCDE)">
                    <TextAreaField label="A - Airway" name="airway" value={formState.airway} onChange={handleChange} />
                    <TextAreaField label="B - Breathing" name="breathing" value={formState.breathing} onChange={handleChange} />
                    <TextAreaField label="C - Circulation" name="circulation" value={formState.circulation} onChange={handleChange} />
                    <TextAreaField label="D - Disability (AVPU/GCS)" name="disability" value={formState.disability} onChange={handleChange} />
                    <TextAreaField label="E - Exposure & Environment" name="exposure" value={formState.exposure} onChange={handleChange} />
                </Section>
                
                <div className="bg-white p-6 rounded-lg shadow mb-6">
                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                        <h2 className="text-xl font-bold text-ams-blue">Vital Signs / Observations</h2>
                        <button type="button" onClick={addVitalSign} className="no-print flex items-center px-3 py-1 bg-ams-blue text-white rounded-md hover:bg-opacity-90">
                            <PlusIcon className="w-4 h-4 mr-1"/> Add Row
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="text-left text-sm font-medium text-gray-600">
                                    <th className="p-2">Time</th><th className="p-2">HR</th><th className="p-2">RR</th><th className="p-2">BP</th>
                                    <th className="p-2">SpO2</th><th className="p-2">GCS</th><th className="p-2">Temp</th><th className="p-2">BG</th>
                                    <th className="p-2 no-print"></th>
                                </tr>
                            </thead>
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
                                        <td className="no-print">
                                            {formState.vitals.length > 1 && <button type="button" onClick={() => removeVitalSign(index)}><TrashIcon className="w-5 h-5 text-red-500 hover:text-red-700"/></button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Section title="Treatment & Disposal">
                    <TextAreaField label="Treatment Given / Management Plan" name="treatment" value={formState.treatment} onChange={handleChange} />
                    <TextAreaField label="Disposal / Handover Details" name="disposal" value={formState.disposal} onChange={handleChange} />
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
