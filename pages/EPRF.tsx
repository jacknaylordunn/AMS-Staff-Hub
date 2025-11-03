import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import type { EPRFForm, Patient, VitalSign, MedicationAdministered, Intervention, Injury } from '../types';
import { PlusIcon, TrashIcon, SpinnerIcon, CheckIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { searchPatients, addPatient, getActiveDraftEPRF, createDraftEPRF, updateEPRF, finalizeEPRF, deleteEPRF } from '../services/firestoreService';
import { showToast } from '../components/Toast';
import PatientModal from '../components/PatientModal';
import { calculateNews2Score, getNews2RiskColor } from '../utils/news2Calculator';
import InteractiveBodyMap from '../components/InteractiveBodyMap';
import ConfirmationModal from '../components/ConfirmationModal';

// Reducer for complex form state management
const eprfReducer = (state: EPRFForm, action: any): EPRFForm => {
  switch (action.type) {
    case 'LOAD_DRAFT':
      // FIX: The spread operator `...` cannot be used on `action.payload` because its type is `any`, causing a type error.
      // The payload is already a complete and new state object, so we can return it directly.
      return action.payload;
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.payload };
    // FIX: The spread operator `...` cannot be used on types that are not known to be objects.
    // This adds a type guard to ensure the field is an object before spreading, and casts the `any` payload.
    case 'UPDATE_NESTED_FIELD': {
        const field = action.field as keyof EPRFForm;
        const fieldValue = state[field];
        if (typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue)) {
            return {
                ...state,
                [field]: {
                    ...fieldValue,
                    ...(action.payload as object),
                },
            };
        }
        return state;
    }
    case 'UPDATE_GCS':
        const newGcs = { ...state.disability.gcs, [action.field]: action.payload };
        newGcs.total = newGcs.eyes + newGcs.verbal + newGcs.motor;
        return { ...state, disability: { ...state.disability, gcs: newGcs } };
    case 'UPDATE_VITALS':
      return { ...state, vitals: action.payload };
    case 'UPDATE_INJURIES':
        return { ...state, injuries: action.payload };
    case 'UPDATE_DYNAMIC_LIST':
        return { ...state, [action.listName]: action.payload };
    case 'SELECT_PATIENT':
        const age = action.payload.dob ? new Date().getFullYear() - new Date(action.payload.dob).getFullYear() : '';
        return {
            ...state,
            patientId: action.payload.id,
            patientName: `${action.payload.firstName} ${action.payload.lastName}`,
            patientAge: age.toString(),
            patientGender: action.payload.gender,
            allergies: action.payload.allergies,
            medications: action.payload.medications,
            pastMedicalHistory: action.payload.medicalHistory,
        };
    case 'CLEAR_FORM':
      return action.payload;
    default:
      return state;
  }
};

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6 ${className}`}>
    <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {children}
    </div>
  </div>
);

const FieldWrapper: React.FC<{ children: React.ReactNode, className?: string}> = ({children, className}) => <div className={className}>{children}</div>;
const inputBaseClasses = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
const labelBaseClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

const InputField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean }> = 
({ label, name, value, onChange, type = 'text', required = false }) => (
  <FieldWrapper>
    <label htmlFor={name} className={labelBaseClasses}>{label}</label>
    <input type={type} id={name} name={name} value={value} onChange={onChange} required={required} className={inputBaseClasses} />
  </FieldWrapper>
);
const SelectField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }> = 
({ label, name, value, onChange, children }) => (
    <FieldWrapper>
        <label htmlFor={name} className={labelBaseClasses}>{label}</label>
        <select id={name} name={name} value={value} onChange={onChange} className={`${inputBaseClasses} bg-white dark:bg-gray-700`}>
            {children}
        </select>
    </FieldWrapper>
);
const TextAreaField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows?: number; className?: string }> = 
({ label, name, value, onChange, rows = 3, className = "md:col-span-2 lg:col-span-4" }) => (
  <FieldWrapper className={className}>
    <label htmlFor={name} className={labelBaseClasses}>{label}</label>
    <textarea id={name} name={name} value={value} onChange={onChange} rows={rows} className={inputBaseClasses} />
  </FieldWrapper>
);

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
const SaveStatusIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
    let content;
    switch(status) {
        case 'saving':
            content = <><SpinnerIcon className="w-4 h-4 mr-2" /> Saving...</>;
            break;
        case 'saved':
            content = <><CheckIcon className="w-4 h-4 mr-2" /> All changes saved</>;
            break;
        case 'error':
            content = <>Error saving. Retrying...</>;
            break;
        default:
            return null;
    }
    return (
        <div className="sticky top-20 z-20 flex items-center justify-center p-2 text-sm bg-gray-700 text-white rounded-b-lg shadow-lg max-w-xs mx-auto">
            {content}
        </div>
    );
};


const EPRF: React.FC = () => {
    const { user } = useAuth();
    const { activeEvent } = useAppContext();
    const navigate = useNavigate();
    
    const getInitialFormState = useCallback((): EPRFForm => ({
        patientId: null,
        eventId: activeEvent?.id || null,
        eventName: activeEvent?.name || null,
        incidentNumber: `AMS-${Date.now()}`,
        incidentDate: new Date().toISOString().split('T')[0],
        incidentTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
        incidentLocation: activeEvent?.location || '',
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
        vitals: [{ time: new Date().toTimeString().split(' ')[0].substring(0, 5), hr: '', rr: '', bp: '', spo2: '', temp: '', bg: '', painScore: '0', avpu: 'Alert', onOxygen: false }],
        secondarySurvey: '',
        injuries: [],
        medicationsAdministered: [],
        interventions: [],
        disposal: '',
        handoverDetails: '',
        crewMembers: user ? [{ uid: user.uid, name: user.displayName || user.email! }] : [],
        createdAt: Timestamp.now(),
        createdBy: user ? { uid: user.uid, name: user.displayName || user.email! } : { uid: '', name: '' },
        status: 'Draft'
    }), [user, activeEvent]);

    const [state, dispatch] = useReducer(eprfReducer, getInitialFormState());
    
    const [patientSearch, setPatientSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPatientModalOpen, setPatientModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isFormLoading, setIsFormLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    
    // Load or create draft ePRF on mount
    useEffect(() => {
        if (!user || !activeEvent) return;
        
        const loadOrCreateDraft = async () => {
            setIsFormLoading(true);
            try {
                let draft = await getActiveDraftEPRF(user.uid, activeEvent.id);
                if (!draft) {
                    draft = await createDraftEPRF(getInitialFormState());
                }
                dispatch({ type: 'LOAD_DRAFT', payload: draft });
            } catch (error) {
                console.error("Error loading/creating draft:", error);
                showToast("Could not load ePRF draft.", "error");
            } finally {
                setIsFormLoading(false);
            }
        };
        loadOrCreateDraft();
    }, [user, activeEvent, getInitialFormState]);

    // Auto-save form every 10 seconds
    useEffect(() => {
        if (isFormLoading || !state.id || state.status !== 'Draft') return;

        const handler = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                await updateEPRF(state.id!, state);
                setSaveStatus('saved');
            } catch (error) {
                console.error("Autosave failed:", error);
                setSaveStatus('error');
            }
        }, 10000);

        return () => clearTimeout(handler);
    }, [state, isFormLoading]);
    
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (patientSearch.length > 2) {
                setSearchLoading(true);
                const results = await searchPatients(patientSearch);
                setSearchResults(results);
                setSearchLoading(false);
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [patientSearch]);
    
    useEffect(() => {
        const newVitals = state.vitals.map(v => ({...v, news2: calculateNews2Score(v)}));
        if (JSON.stringify(newVitals) !== JSON.stringify(state.vitals)) {
            dispatch({ type: 'UPDATE_VITALS', payload: newVitals});
        }
    }, [state.vitals]);


    const handleSelectPatient = (patient: Patient) => {
        dispatch({ type: 'SELECT_PATIENT', payload: patient });
        setPatientSearch('');
        setSearchResults([]);
    };
    
    const handleSaveNewPatient = async (newPatient: Omit<Patient, 'id' | 'createdAt'>) => {
        try {
            const patientId = await addPatient(newPatient);
            handleSelectPatient({ ...newPatient, id: patientId, createdAt: Timestamp.now() });
            showToast('Patient created successfully.', 'success');
            setPatientModalOpen(false);
        } catch (error) {
            console.error(error);
            showToast('Failed to create patient.', 'error');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => dispatch({ type: 'UPDATE_FIELD', field: e.target.name, payload: e.target.value });
    const handleGCSChange = (e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'UPDATE_GCS', field: e.target.name, payload: parseInt(e.target.value, 10)});

    const handleVitalChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newVitals = [...state.vitals];
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        newVitals[index] = { ...newVitals[index], [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value };
        dispatch({ type: 'UPDATE_VITALS', payload: newVitals });
    };

    const addVitalSign = () => dispatch({ type: 'UPDATE_VITALS', payload: [...state.vitals, { time: new Date().toTimeString().split(' ')[0].substring(0, 5), hr: '', rr: '', bp: '', spo2: '', temp: '', bg: '', painScore: '0', avpu: 'Alert', onOxygen: false }]});
    const removeVitalSign = (index: number) => dispatch({ type: 'UPDATE_VITALS', payload: state.vitals.filter((_, i) => i !== index) });

    const handleDynamicListChange = (listName: 'medicationsAdministered' | 'interventions', index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newList = [...state[listName]];
        newList[index] = { ...newList[index], [e.target.name]: e.target.value };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: newList});
    }
    const addDynamicListItem = (listName: 'medicationsAdministered' | 'interventions') => {
        const newItem = listName === 'medicationsAdministered' 
            ? { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), medication: '', dose: '', route: 'PO' as const }
            : { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), intervention: '', details: '' };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: [...state[listName], newItem]});
    }
    const removeDynamicListItem = (listName: 'medicationsAdministered' | 'interventions', index: number) => {
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: state[listName].filter((_, i) => i !== index)});
    }
    
    const handleInjuriesChange = (newInjuries: Injury[]) => {
        dispatch({ type: 'UPDATE_INJURIES', payload: newInjuries });
    };

    const handleFinalize = async () => {
        if(!state.patientId) {
            showToast('Please select or create a patient before finalizing.', 'error');
            return;
        }
        if(!state.id) {
            showToast('Error: No active draft ID found.', 'error');
            return;
        }
        if (!window.confirm("Are you sure you want to finalize this ePRF? You will not be able to edit it after finalizing.")) {
            return;
        }
        setIsSaving(true);
        try {
            await finalizeEPRF(state.id, state);
            showToast('ePRF submitted for review!', 'success');
            navigate('/dashboard');
        } catch (error) {
            console.error("Failed to finalize ePRF: ", error);
            showToast('Error: Could not finalize ePRF.', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteConfirm = async () => {
        if (!state.id) return;
        setIsDeleting(true);
        try {
            await deleteEPRF(state.id);
            showToast("Draft deleted.", "success");
            setIsDeleteModalOpen(false);
            dispatch({ type: 'CLEAR_FORM', payload: getInitialFormState() });
            // Manually trigger a re-creation of a new draft.
            const newDraft = await createDraftEPRF(getInitialFormState());
            dispatch({ type: 'LOAD_DRAFT', payload: newDraft });
        } catch (error) {
            console.error("Failed to delete draft:", error);
            showToast("Could not delete draft.", "error");
        } finally {
            setIsDeleting(false);
        }
    }
    
    if (!activeEvent) {
        return (
            <div className="text-center p-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue">No Active Event</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Please log on to an event from the Events page before creating an ePRF.</p>
                <Link to="/events" className="mt-4 inline-block px-6 py-2 bg-ams-light-blue text-white rounded-md">Go to Events</Link>
            </div>
        );
    }
    
    if (isFormLoading) {
        return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-10 h-10 text-ams-blue" /> <span className="ml-4 text-gray-600 dark:text-gray-300">Loading ePRF...</span></div>;
    }

    return (
        <div className="eprf-form-container">
             <SaveStatusIndicator status={saveStatus} />
             <PatientModal isOpen={isPatientModalOpen} onClose={() => setPatientModalOpen(false)} onSave={handleSaveNewPatient} />
             <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Draft"
                message="Are you sure you want to delete this draft? This action cannot be undone."
                confirmText="Delete"
                isLoading={isDeleting}
             />
            <form onSubmit={(e) => e.preventDefault()}>
                <Section title="Patient Selection">
                   <FieldWrapper className="lg:col-span-3 relative">
                     <label htmlFor="patientSearch" className={labelBaseClasses}>Search Existing Patient (Name or DOB)</label>
                     <input type="text" id="patientSearch" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className={inputBaseClasses} placeholder="Start typing..."/>
                      {searchLoading && <SpinnerIcon className="w-5 h-5 text-gray-400 absolute right-3 top-9"/>}
                     {searchResults.length > 0 && (
                         <ul className="absolute z-10 w-full border bg-white border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto dark:bg-gray-700 dark:border-gray-600">
                             {searchResults.map(p => <li key={p.id} onClick={() => handleSelectPatient(p)} className="p-2 hover:bg-ams-light-blue hover:text-white cursor-pointer dark:text-gray-200">{p.firstName} {p.lastName} - {p.dob}</li>)}
                         </ul>
                     )}
                   </FieldWrapper>
                   <FieldWrapper>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 invisible">New Patient</label>
                     <button type="button" onClick={() => setPatientModalOpen(true)} className="mt-1 w-full px-4 py-2 font-semibold text-white bg-ams-blue rounded-md hover:bg-opacity-90">Create New Patient</button>
                   </FieldWrapper>
                </Section>
                
                <Section title="Incident & Patient Details">
                    <InputField label="Incident Number" name="incidentNumber" value={state.incidentNumber} onChange={handleChange} required />
                    <InputField label="Date" name="incidentDate" type="date" value={state.incidentDate} onChange={handleChange} required />
                    <InputField label="Time" name="incidentTime" type="time" value={state.incidentTime} onChange={handleChange} required />
                    <InputField label="Location" name="incidentLocation" value={state.incidentLocation} onChange={handleChange} required />
                    <InputField label="Full Name" name="patientName" value={state.patientName} onChange={handleChange} required />
                    <InputField label="Age" name="patientAge" value={state.patientAge} onChange={handleChange} />
                    <SelectField label="Gender" name="patientGender" value={state.patientGender} onChange={handleChange}><option>Unknown</option><option>Male</option><option>Female</option><option>Other</option></SelectField>
                </Section>
                
                <Section title="Clinical Information (History & Complaint)">
                    <TextAreaField label="Presenting Complaint" name="presentingComplaint" value={state.presentingComplaint} onChange={handleChange} />
                    <TextAreaField label="History of Complaint / Events" name="history" value={state.history} onChange={handleChange} />
                     <TextAreaField label="Mechanism of Injury (if applicable)" name="mechanismOfInjury" value={state.mechanismOfInjury || ''} onChange={handleChange} />
                </Section>

                <Section title="SAMPLE History">
                    <TextAreaField label="Allergies" name="allergies" value={state.allergies} onChange={handleChange} />
                    <TextAreaField label="Medications" name="medications" value={state.medications} onChange={handleChange} />
                    <TextAreaField label="Past Medical History" name="pastMedicalHistory" value={state.pastMedicalHistory} onChange={handleChange} />
                </Section>

                <Section title="Primary Survey (ABCDE)">
                    <TextAreaField label="A - Airway" name="airway" value={state.airway} onChange={handleChange} />
                    <TextAreaField label="B - Breathing" name="breathing" value={state.breathing} onChange={handleChange} />
                    <TextAreaField label="C - Circulation" name="circulation" value={state.circulation} onChange={handleChange} />
                    <TextAreaField label="E - Exposure & Environment" name="exposure" value={state.exposure} onChange={handleChange} />
                </Section>
                
                <Section title="D - Disability">
                    <SelectField label="AVPU" name="avpu" value={state.disability.avpu} onChange={e => dispatch({type: 'UPDATE_NESTED_FIELD', field: 'disability', payload: {avpu: e.target.value}})}>
                        <option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option>
                    </SelectField>
                    <SelectField label="GCS - Eyes" name="eyes" value={state.disability.gcs.eyes} onChange={handleGCSChange}>
                        <option value={4}>4 - Spontaneous</option><option value={3}>3 - To Voice</option><option value={2}>2 - To Pain</option><option value={1}>1 - None</option>
                    </SelectField>
                    <SelectField label="GCS - Verbal" name="verbal" value={state.disability.gcs.verbal} onChange={handleGCSChange}>
                        <option value={5}>5 - Orientated</option><option value={4}>4 - Confused</option><option value={3}>3 - Inappropriate Words</option><option value={2}>2 - Incomprehensible Sounds</option><option value={1}>1 - None</option>
                    </SelectField>
                     <SelectField label="GCS - Motor" name="motor" value={state.disability.gcs.motor} onChange={handleGCSChange}>
                        <option value={6}>6 - Obeys Commands</option><option value={5}>5 - Localises Pain</option><option value={4}>4 - Withdraws from Pain</option><option value={3}>3 - Abnormal Flexion</option><option value={2}>2 - Abnormal Extension</option><option value={1}>1 - None</option>
                    </SelectField>
                     <InputField label="GCS Total" name="gcsTotal" value={state.disability.gcs.total} onChange={() => {}} />
                     <InputField label="Pupils" name="pupils" value={state.disability.pupils} onChange={e => dispatch({type: 'UPDATE_NESTED_FIELD', field: 'disability', payload: {pupils: e.target.value}})}/>
                </Section>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 mb-4">
                        <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">Vital Signs / Observations</h2>
                        <button type="button" onClick={addVitalSign} className="flex items-center px-3 py-1 bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/> Add Row</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead><tr className="text-left text-xs font-medium text-gray-600 dark:text-gray-400"><th className="p-2">Time</th><th className="p-2">HR</th><th className="p-2">RR</th><th className="p-2">BP</th><th className="p-2">SpO2</th><th className="p-2">Temp</th><th className="p-2">BG</th><th className="p-2">Pain</th><th className="p-2">AVPU</th><th className="p-2">On O2?</th><th className="p-2">NEWS2</th><th className="p-2"></th></tr></thead>
                            <tbody>
                                {state.vitals.map((vital, index) => (
                                    <tr key={index} className="border-t dark:border-gray-700">
                                        <td><input type="time" name="time" value={vital.time} onChange={(e) => handleVitalChange(index, e)} className={`${inputBaseClasses} w-24 p-1`}/></td>
                                        <td><input name="hr" value={vital.hr} onChange={(e) => handleVitalChange(index, e)} className={`${inputBaseClasses} w-16 p-1`}/></td>
                                        <td><input name="rr" value={vital.rr} onChange={(e) => handleVitalChange(index, e)} className={`${inputBaseClasses} w-16 p-1`}/></td>
                                        <td><input name="bp" value={vital.bp} onChange={(e) => handleVitalChange(index, e)} className={`${inputBaseClasses} w-20 p-1`}/></td>
                                        <td><input name="spo2" value={vital.spo2} onChange={(e) => handleVitalChange(index, e)} className={`${inputBaseClasses} w-16 p-1`}/></td>
                                        <td><input name="temp" value={vital.temp} onChange={(e) => handleVitalChange(index, e)} className={`${inputBaseClasses} w-16 p-1`}/></td>
                                        <td><input name="bg" value={vital.bg} onChange={(e) => handleVitalChange(index, e)} className={`${inputBaseClasses} w-16 p-1`}/></td>
                                        <td><input type="number" name="painScore" value={vital.painScore} onChange={(e) => handleVitalChange(index, e)} className={`${inputBaseClasses} w-16 p-1`} min="0" max="10"/></td>
                                        <td>
                                            <select name="avpu" value={vital.avpu} onChange={e => handleVitalChange(index, e)} className={`${inputBaseClasses} w-24 p-1 bg-white dark:bg-gray-700`}>
                                                <option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option>
                                            </select>
                                        </td>
                                        <td className="text-center"><input type="checkbox" name="onOxygen" checked={vital.onOxygen} onChange={e => handleVitalChange(index, e)} className="h-5 w-5"/></td>
                                        <td className="p-2 text-center">
                                            <span className={`px-2 py-1 font-bold rounded-full text-white text-xs ${getNews2RiskColor(vital.news2)}`}>
                                                {vital.news2 ?? 'N/A'}
                                            </span>
                                        </td>
                                        <td>{state.vitals.length > 1 && <button type="button" onClick={() => removeVitalSign(index)}><TrashIcon className="w-5 h-5 text-red-500 hover:text-red-700"/></button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Secondary Survey & Injury Map</h2>
                    <TextAreaField label="Head-to-toe assessment findings" name="secondarySurvey" value={state.secondarySurvey} onChange={handleChange} rows={4} />
                    <div className="md:col-span-2 lg:col-span-4 mt-4">
                        <InteractiveBodyMap value={state.injuries} onChange={handleInjuriesChange} />
                    </div>
                </div>
                
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 mb-4">
                        <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">Medications Administered</h2>
                        <button type="button" onClick={() => addDynamicListItem('medicationsAdministered')} className="flex items-center px-3 py-1 bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/> Add Med</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead><tr className="text-left text-xs font-medium text-gray-600 dark:text-gray-400"><th className="p-2">Time</th><th className="p-2">Medication</th><th className="p-2">Dose</th><th className="p-2">Route</th><th className="p-2"></th></tr></thead>
                            <tbody>
                                {state.medicationsAdministered.map((med, index) => (
                                    <tr key={med.id} className="border-t dark:border-gray-700">
                                        <td><input type="time" name="time" value={med.time} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} w-24 p-1`}/></td>
                                        <td><input name="medication" value={med.medication} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} w-full p-1`}/></td>
                                        <td><input name="dose" value={med.dose} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} w-full p-1`}/></td>
                                        <td>
                                            <select name="route" value={med.route} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} w-full p-1 bg-white dark:bg-gray-700`}>
                                                <option>PO</option><option>IV</option><option>IM</option><option>SC</option><option>SL</option><option>PR</option><option>Nebulised</option><option>Other</option>
                                            </select>
                                        </td>
                                        <td><button type="button" onClick={() => removeDynamicListItem('medicationsAdministered', index)}><TrashIcon className="w-5 h-5 text-red-500 hover:text-red-700"/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2 mb-4">
                        <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">Interventions / Procedures</h2>
                        <button type="button" onClick={() => addDynamicListItem('interventions')} className="flex items-center px-3 py-1 bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/> Add</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead><tr className="text-left text-xs font-medium text-gray-600 dark:text-gray-400"><th className="p-2">Time</th><th className="p-2">Intervention</th><th className="p-2">Details</th><th className="p-2"></th></tr></thead>
                            <tbody>
                                {state.interventions.map((item, index) => (
                                    <tr key={item.id} className="border-t dark:border-gray-700">
                                        <td><input type="time" name="time" value={item.time} onChange={e => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} w-24 p-1`}/></td>
                                        <td><input name="intervention" value={item.intervention} onChange={e => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} w-full p-1`}/></td>
                                        <td><input name="details" value={item.details} onChange={e => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} w-full p-1`}/></td>
                                        <td><button type="button" onClick={() => removeDynamicListItem('interventions', index)}><TrashIcon className="w-5 h-5 text-red-500 hover:text-red-700"/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Section title="Disposal & Handover">
                    <InputField label="Disposal (e.g., Hospital, Home, Police)" name="disposal" value={state.disposal} onChange={handleChange} />
                    <TextAreaField label="Handover Details (Crew name/number, facility, etc.)" name="handoverDetails" value={state.handoverDetails} onChange={handleChange} className="md:col-span-2 lg:col-span-3"/>
                </Section>
                
                <div className="flex justify-between items-center gap-4 mt-8">
                    <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 disabled:bg-gray-400 flex items-center">
                        <TrashIcon className="w-5 h-5 mr-2" />
                        Delete Draft
                    </button>
                    <button type="button" onClick={handleFinalize} disabled={isSaving} className="px-6 py-3 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                        {isSaving && <SpinnerIcon className="w-5 h-5 mr-2" />}
                        Finalize & Submit for Review
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EPRF;