import React from 'react';
import type { EPRFForm, Patient } from '../../types';
import { Section, InputField, SelectField, labelBaseClasses, inputBaseClasses } from './FormControls';
import SpeechEnabledTextArea from '../SpeechEnabledTextArea';
import TaggableInput from '../TaggableInput';
import { SpinnerIcon, PlusIcon } from '../icons';

interface Step2Props {
    state: EPRFForm;
    dispatch: React.Dispatch<any>;
    patientSearch: string;
    setPatientSearch: (search: string) => void;
    searchResults: Patient[];
    searchLoading: boolean;
    handleSelectPatient: (patient: Patient) => void;
    setPatientModalOpen: (isOpen: boolean) => void;
}

const Step2_Patient: React.FC<Step2Props> = ({ 
    state, dispatch, 
    patientSearch, setPatientSearch, searchResults, searchLoading,
    handleSelectPatient, setPatientModalOpen 
}) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        dispatch({ type: 'UPDATE_FIELD', field: e.target.name, payload: e.target.value });
    };

    return (
        <div>
            <Section title="Patient Information">
                <div className="md:col-span-4 lg:col-span-4 relative">
                    <label htmlFor="patientSearch" className={labelBaseClasses}>Search for Existing Patient</label>
                    <input
                        type="text"
                        id="patientSearch"
                        value={patientSearch}
                        onChange={e => setPatientSearch(e.target.value)}
                        className={inputBaseClasses}
                        placeholder="Search by name or DOB..."
                        disabled={!!state.patientId}
                    />
                    {searchLoading && <SpinnerIcon className="absolute top-8 right-2 w-5 h-5 text-gray-400" />}
                    {searchResults.length > 0 && !state.patientId && (
                        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                            {searchResults.map(p => (
                                <li key={p.id} onClick={() => handleSelectPatient(p)} className="px-4 py-2 cursor-pointer hover:bg-ams-light-blue hover:text-white">
                                    {p.firstName} {p.lastName} ({p.dob})
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="md:col-span-4 lg:col-span-4">
                    {!state.patientId ? (
                        <button type="button" onClick={() => setPatientModalOpen(true)} className="flex items-center text-sm px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90">
                            <PlusIcon className="w-4 h-4 mr-2" /> Create New Patient Record
                        </button>
                    ) : (
                         <button type="button" onClick={() => dispatch({ type: 'CLEAR_PATIENT' })} className="flex items-center text-sm px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300">
                            Clear Patient & Enter Manually
                        </button>
                    )}
                </div>

                <InputField label="Patient Name*" name="patientName" value={state.patientName} onChange={handleChange} required className="md:col-span-2" disabled={!!state.patientId} />
                <InputField label="Patient Age*" name="patientAge" value={state.patientAge} onChange={handleChange} required disabled={!!state.patientId}/>
                <SelectField label="Patient Gender" name="patientGender" value={state.patientGender} onChange={handleChange} disabled={!!state.patientId}>
                    <option>Unknown</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                </SelectField>
            </Section>
             <Section title="Clinical History (SAMPLE)">
                <SpeechEnabledTextArea label="Presenting Complaint*" name="presentingComplaint" value={state.presentingComplaint} onChange={e => handleChange(e as any)} className={state.presentationType !== 'Welfare/Intox' ? 'md:col-span-2 lg:col-span-4' : 'hidden'}/>
                <SpeechEnabledTextArea label="History of Presenting Complaint" name="history" value={state.history} onChange={e => handleChange(e as any)} />
                <TaggableInput label="Allergies" value={state.allergies} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'allergies', payload: v})} suggestions={['NKDA']} placeholder="Type and press Enter..." className="md:col-span-2"/>
                <TaggableInput label="Medications" value={state.medications} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'medications', payload: v})} suggestions={['None']} placeholder="Type and press Enter..." className="md:col-span-2"/>
                <SpeechEnabledTextArea label="Past Medical History" name="pastMedicalHistory" value={state.pastMedicalHistory} onChange={e => handleChange(e as any)} />
                <SpeechEnabledTextArea label="Social History" name="socialHistory" value={state.socialHistory || ''} onChange={e => dispatch({type: 'UPDATE_FIELD', field: 'socialHistory', payload: e.target.value})} className="md:col-span-2" />
                <InputField label="Last Oral Intake" name="lastOralIntake" value={state.lastOralIntake} onChange={handleChange} className="md:col-span-2" />
            </Section>
        </div>
    );
};

export default Step2_Patient;
