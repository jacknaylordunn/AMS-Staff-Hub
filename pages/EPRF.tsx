import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import type { EPRFForm, Patient, VitalSign, MedicationAdministered, Intervention, Injury, WelfareLogEntry, User as AppUser, ClinicalSuggestion, Attachment } from '../types';
import { PlusIcon, TrashIcon, SpinnerIcon, CheckIcon, SparklesIcon, CameraIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { searchPatients, addPatient, getActiveDraftEPRF, createDraftEPRF, updateEPRF, finalizeEPRF, deleteEPRF, getUsers } from '../services/firestoreService';
import { showToast } from '../components/Toast';
import PatientModal from '../components/PatientModal';
import { calculateNews2Score, getNews2RiskColor } from '../utils/news2Calculator';
import InteractiveBodyMap from '../components/InteractiveBodyMap';
import ConfirmationModal from '../components/ConfirmationModal';
import SpeechEnabledTextArea from '../components/SpeechEnabledTextArea';
import ValidationModal from '../components/ValidationModal';

const RESTRICTED_MEDICATIONS = ['Morphine Sulphate', 'Ketamine', 'Midazolam', 'Ondansetron', 'Adrenaline 1:1000'];
const SENIOR_CLINICIAN_ROLES: AppUser['role'][] = ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];

// Reducer for complex form state management
const eprfReducer = (state: EPRFForm, action: any): EPRFForm => {
  switch (action.type) {
    case 'LOAD_DRAFT':
      return action.payload;
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.payload };
    case 'DISMISS_REVIEW_NOTES':
      return { ...state, reviewNotes: undefined };
    case 'UPDATE_NESTED_FIELD': {
        const { field, subField, payload } = action;
        return {
            ...state,
            [field]: {
                // Fix: Cast to object for spread operator. Based on usage, 'field' will always be an object property on the state.
                ...(state[field as keyof EPRFForm] as object),
                [subField]: payload
            }
        };
    }
    case 'UPDATE_CHECKBOX_ARRAY': {
        const { field, subField, value, checked } = action;
        const parentObject = state[field as keyof EPRFForm];
        // The parent field (e.g., 'safeguarding') is an object. We cast to `any` to safely access the sub-property (e.g., 'concerns')
        const currentArray = (parentObject as any)[subField] as string[] || [];
        
        const newArray = checked 
            ? [...currentArray, value]
            : currentArray.filter(item => item !== value);
        return {
             ...state,
            [field]: {
                // Fix: Cast the nested state property to an object to satisfy TypeScript's spread operator requirements.
                // The usage of this action ensures `field` refers to an object property on the state.
                ...(parentObject as object),
                [subField]: newArray
            }
        }
    }
    case 'UPDATE_GCS':
        const newGcs = { ...state.disability.gcs, [action.field]: action.payload };
        newGcs.total = newGcs.eyes + newGcs.verbal + newGcs.motor;
        return { ...state, disability: { ...state.disability, gcs: newGcs } };
    case 'UPDATE_VITALS':
      return { ...state, vitals: action.payload };
    case 'UPDATE_INJURIES':
        return { ...state, injuries: action.payload };
    case 'UPDATE_ATTACHMENTS':
        return { ...state, attachments: action.payload };
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
const inputBaseClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
const labelBaseClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

const InputField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean; className?: string; }> = 
({ label, name, value, onChange, type = 'text', required = false, className }) => (
  <FieldWrapper className={className}>
    <label htmlFor={name} className={labelBaseClasses}>{label}</label>
    <input type={type} id={name} name={name} value={value} onChange={onChange} required={required} className={inputBaseClasses} />
  </FieldWrapper>
);
const SelectField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode, className?: string }> = 
({ label, name, value, onChange, children, className }) => (
    <FieldWrapper className={className}>
        <label htmlFor={name} className={labelBaseClasses}>{label}</label>
        <select id={name} name={name} value={value} onChange={onChange} className={inputBaseClasses}>
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
const CheckboxField: React.FC<{ label: string; name: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ label, name, checked, onChange }) => (
    <div className="flex items-center">
        <input type="checkbox" id={name} name={name} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-ams-light-blue focus:ring-ams-light-blue" />
        <label htmlFor={name} className="ml-2 block text-sm text-gray-900 dark:text-gray-300">{label}</label>
    </div>
);

type SaveStatus = 'idle' | 'saving' | 'saved-online' | 'saved-offline' | 'error' | 'syncing';

const SaveStatusIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
    let content, colorClass, title;
    switch(status) {
        case 'saving':
            content = <><SpinnerIcon className="w-4 h-4 mr-2" /> Saving...</>;
            colorClass = 'bg-gray-600';
            title = 'Saving your changes.';
            break;
        case 'syncing':
            content = <><SpinnerIcon className="w-4 h-4 mr-2" /> Syncing...</>;
            colorClass = 'bg-blue-600';
            title = 'Syncing local changes with the cloud.';
            break;
        case 'saved-online':
            content = <><CheckIcon className="w-4 h-4 mr-2" /> Saved to cloud</>;
            colorClass = 'bg-green-600';
            title = 'Your changes have been saved to the server.';
            break;
        case 'saved-offline':
            content = <><CheckIcon className="w-4 h-4 mr-2" /> Saved locally</>;
            colorClass = 'bg-yellow-500 text-black';
            title = 'You are offline. Your changes have been saved locally and will sync when you reconnect.';
            break;
        case 'error':
            content = <>Save Error</>;
            colorClass = 'bg-red-600';
            title = 'There was an error saving your changes.';
            break;
        default:
            return null;
    }
    return (
        <div title={title} className={`fixed top-24 right-4 z-50 flex items-center p-2 text-xs text-white rounded-md shadow-lg ${colorClass}`}>
            {content}
        </div>
    );
};


const commonImpressions = [ 'ACS', 'Anaphylaxis', 'Asthma', 'CVA / Stroke', 'DKA', 'Drug Overdose', 'Ethanol Intoxication', 'Fall', 'Fracture', 'GI Bleed', 'Head Injury', 'Hypoglycaemia', 'Mental Health Crisis', 'Minor Injury', 'Post-ictal', 'Seizure', 'Sepsis', 'Shortness of Breath', 'Syncope', 'Trauma' ];

const ImpressionsInput: React.FC<{ value: string[], onChange: (value: string[]) => void }> = ({ value, onChange }) => {
    const [inputValue, setInputValue] = useState('');
    const filteredImpressions = commonImpressions.filter(
        i => i.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(i) && inputValue
    );

    const addImpression = (impression: string) => {
        if (impression && !value.includes(impression)) {
            onChange([...value, impression]);
        }
        setInputValue('');
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue) {
            e.preventDefault();
            addImpression(inputValue);
        }
    };

    const removeImpression = (impression: string) => {
        onChange(value.filter(i => i !== impression));
    };

    return (
        <div className="relative">
            <label className={labelBaseClasses}>Working Impressions</label>
            <div className="flex flex-wrap gap-2 p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md min-h-[42px]">
                {value.map(imp => (
                    <span key={imp} className="flex items-center gap-2 bg-ams-blue text-white text-sm font-semibold px-2 py-1 rounded-full">
                        {imp}
                        <button type="button" onClick={() => removeImpression(imp)} className="text-white hover:text-red-300">&times;</button>
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-grow bg-transparent focus:outline-none dark:text-gray-200"
                    placeholder={value.length === 0 ? "e.g., Asthma, Fall..." : ""}
                />
            </div>
            {filteredImpressions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredImpressions.map(imp => (
                        <li key={imp} onClick={() => addImpression(imp)} className="px-4 py-2 cursor-pointer hover:bg-ams-light-blue hover:text-white dark:text-gray-200">
                            {imp}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};


const EPRF: React.FC = () => {
    const { user } = useAuth();
    const { activeEvent } = useAppContext();
    const { isOnline } = useOnlineStatus();
    const navigate = useNavigate();
    
    const getInitialFormState = useCallback((): EPRFForm => {
      const now = new Date();
      const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
      const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
      return {
        patientId: null,
        eventId: activeEvent?.id || null,
        eventName: activeEvent?.name || null,
        presentationType: 'Medical/Trauma',
        incidentNumber: `AMS-${Date.now()}`,
        incidentDate: now.toISOString().split('T')[0],
        incidentTime: timeString,
        timeOfCall: timeString,
        onSceneTime: timeString,
        atPatientTime: '',
        leftSceneTime: '',
        atDestinationTime: '',
        clearDestinationTime: '',
        incidentLocation: activeEvent?.location || '',
        patientName: '',
        patientAge: '',
        patientGender: 'Unknown',
        presentingComplaint: '',
        history: '',
        mechanismOfInjury: '',
        allergies: '',
        medications: '',
        pastMedicalHistory: '',
        painAssessment: { onset: '', provocation: '', quality: '', radiation: '', severity: 0, time: '' },
        airway: '',
        breathing: '',
        circulation: '',
        disability: { avpu: 'Alert', gcs: { eyes: 4, verbal: 5, motor: 6, total: 15 }, pupils: ''},
        exposure: '',
        vitals: [{ time: timeString, hr: '', rr: '', bp: '', spo2: '', temp: '', bg: '', painScore: '0', avpu: 'Alert', onOxygen: false }],
        secondarySurvey: '',
        injuries: [],
        impressions: [],
        medicationsAdministered: [],
        interventions: [],
        disposal: '',
        disposition: 'Not Set',
        dispositionDetails: { destination: '', receivingClinician: '', referralDetails: '' },
        handoverDetails: '',
        refusalOfCare: { refusedTreatment: false, refusedTransport: false, risksExplained: false, capacityDemonstrated: false, details: '' },
        safeguarding: { concerns: [], details: '' },
        mentalCapacity: { assessment: [], outcome: 'Not Assessed', details: '' },
        welfareLog: [],
        attachments: [],
        crewMembers: user ? [{ uid: user.uid, name: fullName }] : [],
        createdAt: Timestamp.now(),
        createdBy: user ? { uid: user.uid, name: fullName } : { uid: '', name: '' },
        status: 'Draft',
        auditLog: [],
      }
    }, [user, activeEvent]);

    const [state, dispatch] = useReducer(eprfReducer, getInitialFormState());
    
    const [patientSearch, setPatientSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPatientModalOpen, setPatientModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isValidationModalOpen, setValidationModalOpen] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isFormLoading, setIsFormLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [allStaff, setAllStaff] = useState<AppUser[]>([]);
    const [selectedCrewMember, setSelectedCrewMember] = useState<string>('');
    const [suggestions, setSuggestions] = useState<ClinicalSuggestion | null>(null);
    const [isSuggesting, setIsSuggesting] = useState(false);
    
    useEffect(() => {
        getUsers().then(setAllStaff);
    }, []);

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

    // Auto-save form
    useEffect(() => {
        if (isFormLoading || !state.id || state.status !== 'Draft') return;

        const handler = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                await updateEPRF(state.id!, state);
                setSaveStatus(isOnline ? 'saved-online' : 'saved-offline');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                console.error("Autosave failed:", error);
                setSaveStatus('error');
            }
        }, 5000);

        return () => clearTimeout(handler);
    }, [state, isFormLoading, isOnline]);
    
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
    const handleNestedChange = (field: string, subField: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const target = e.target as HTMLInputElement;
        const payload = target.type === 'checkbox' ? target.checked : target.value;
        dispatch({ type: 'UPDATE_NESTED_FIELD', field, subField, payload });
    };
    const handleCheckboxArrayChange = (field: string, subField: string, e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'UPDATE_CHECKBOX_ARRAY', field, subField, value: e.target.name, checked: e.target.checked });


    const handleVitalChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newVitals = [...state.vitals];
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        newVitals[index] = { ...newVitals[index], [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value };
        dispatch({ type: 'UPDATE_VITALS', payload: newVitals });
    };

    const addVitalSign = () => dispatch({ type: 'UPDATE_VITALS', payload: [...state.vitals, { time: new Date().toTimeString().split(' ')[0].substring(0, 5), hr: '', rr: '', bp: '', spo2: '', temp: '', bg: '', painScore: '0', avpu: 'Alert', onOxygen: false }]});
    const removeVitalSign = (index: number) => dispatch({ type: 'UPDATE_VITALS', payload: state.vitals.filter((_, i) => i !== index) });

    const handleDynamicListChange = (listName: 'medicationsAdministered' | 'interventions' | 'welfareLog', index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newList = [...state[listName]];
        (newList[index] as any) = { ...newList[index], [e.target.name]: e.target.value };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: newList});
    }
    const addDynamicListItem = (listName: 'medicationsAdministered' | 'interventions' | 'welfareLog') => {
        let newItem;
        if (listName === 'medicationsAdministered') {
            newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), medication: '', dose: '', route: 'PO' as const };
        } else if (listName === 'interventions') {
            newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), intervention: '', details: '' };
        } else { // welfareLog
             newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), observation: '' };
        }
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: [...state[listName], newItem]});
    }
    const removeDynamicListItem = (listName: 'medicationsAdministered' | 'interventions' | 'welfareLog', index: number) => {
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: state[listName].filter((_, i) => i !== index)});
    }

    const handleAuthoriseMed = (index: number) => {
        if (!user) return;
        const newList = [...state.medicationsAdministered];
        newList[index] = {
            ...newList[index],
            authorisedBy: {
                uid: user.uid,
                name: `${user.firstName} ${user.lastName}`.trim()
            }
        };
        dispatch({ type: 'UPDATE_DYNAMIC_LIST', listName: 'medicationsAdministered', payload: newList });
    };

    const handleInjuriesChange = (newInjuries: Injury[]) => {
        dispatch({ type: 'UPDATE_INJURIES', payload: newInjuries });
    };

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

    const resizeImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        });
    };

    const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                const base64 = await fileToBase64(file);
                const resizedBase64 = await resizeImage(base64);
                const newAttachment: Attachment = {
                    id: Date.now().toString(),
                    base64Data: resizedBase64,
                    mimeType: 'image/jpeg',
                    description: '',
                };
                dispatch({ type: 'UPDATE_ATTACHMENTS', payload: [...state.attachments, newAttachment] });
            } catch (error) {
                console.error("Error processing image:", error);
                showToast("Could not process image.", "error");
            }
        }
    };
    const handleRemoveAttachment = (id: string) => {
        dispatch({ type: 'UPDATE_ATTACHMENTS', payload: state.attachments.filter(a => a.id !== id) });
    };
    const handleAttachmentDescriptionChange = (id: string, description: string) => {
        const newAttachments = state.attachments.map(a => a.id === id ? { ...a, description } : a);
        dispatch({ type: 'UPDATE_ATTACHMENTS', payload: newAttachments });
    };

    
    const handleAddCrewMember = () => {
        if (selectedCrewMember && !state.crewMembers.some(cm => cm.uid === selectedCrewMember)) {
            const staffMember = allStaff.find(s => s.uid === selectedCrewMember);
            if (staffMember) {
                const newCrew = [...state.crewMembers, { uid: staffMember.uid, name: `${staffMember.firstName} ${staffMember.lastName}`.trim() }];
                dispatch({ type: 'UPDATE_FIELD', field: 'crewMembers', payload: newCrew });
            }
        }
        setSelectedCrewMember('');
    };

    const handleRemoveCrewMember = (uid: string) => {
        if (uid === user?.uid) {
            showToast("Cannot remove the primary clinician.", "error");
            return;
        }
        const newCrew = state.crewMembers.filter(cm => cm.uid !== uid);
        dispatch({ type: 'UPDATE_FIELD', field: 'crewMembers', payload: newCrew });
    };

    const handleGetSuggestions = async () => {
        setIsSuggesting(true);
        setSuggestions(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            const latestVitals = state.vitals[state.vitals.length - 1];
            const prompt = `
                You are a clinical decision support tool for pre-hospital clinicians.
                Based on the following patient assessment, provide a list of 3 likely differential diagnoses (impressions) and suggest 3 key management actions or interventions.
                Be concise and format for a clinical setting.

                Patient Age: ${state.patientAge}
                Patient Gender: ${state.patientGender}
                Presenting Complaint: ${state.presentingComplaint}
                History: ${state.history}
                Past Medical History: ${state.pastMedicalHistory}
                Allergies: ${state.allergies}
                Medications: ${state.medications}
                Latest Vitals: 
                - HR: ${latestVitals.hr}
                - RR: ${latestVitals.rr}
                - BP: ${latestVitals.bp}
                - SpO2: ${latestVitals.spo2}% ${latestVitals.onOxygen ? 'on Oxygen' : ''}
                - Temp: ${latestVitals.temp}°C
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            impressions: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "A list of 3 likely differential diagnoses or clinical impressions."
                            },
                            interventions: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "A list of 3 key recommended interventions or management actions."
                            }
                        }
                    }
                }
            });
            
            const jsonText = response.text.trim();
            const suggestionData = JSON.parse(jsonText) as ClinicalSuggestion;
            setSuggestions(suggestionData);

        } catch (error) {
            console.error("Error getting AI suggestions:", error);
            showToast("Could not get AI suggestions. Please check the clinical data.", "error");
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleFinalize = async () => {
        if (!state.id) return;
        
        const errors: string[] = [];
        if (!state.patientId || !state.patientName.trim()) {
            errors.push("A patient must be selected or created.");
        }
        if (!state.presentingComplaint.trim()) {
            errors.push("Presenting Complaint is a required field.");
        }
        if (state.presentationType !== 'Welfare/Intox' && state.vitals.length === 0) {
            errors.push("At least one set of vital signs must be recorded for this presentation type.");
        }
        if (state.disposition === 'Not Set') {
            errors.push("A final disposition must be selected.");
        }
        if (state.crewMembers.length === 0) {
            errors.push("At least one crew member must be on the report.");
        }

        const unauthorisedMeds = state.medicationsAdministered
            .filter(med => RESTRICTED_MEDICATIONS.includes(med.medication) && !med.authorisedBy)
            .map(med => med.medication);
        
        if (unauthorisedMeds.length > 0) {
            errors.push(`The following medications require authorisation by a senior clinician: ${unauthorisedMeds.join(', ')}.`);
        }

        if (errors.length > 0) {
            setValidationErrors(errors);
            setValidationModalOpen(true);
            return;
        }

        setIsSaving(true);
        try {
            await finalizeEPRF(state.id, state);
            showToast("ePRF finalized and sent for review.", "success");
            navigate(`/patients/${state.patientId}`);
        } catch (error) {
            console.error("Finalize failed:", error);
            showToast("Could not finalize ePRF.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!state.id) return;
        setIsDeleting(true);
        try {
            await deleteEPRF(state.id);
            showToast("Draft ePRF deleted.", "success");
            const newDraft = await createDraftEPRF(getInitialFormState());
            dispatch({ type: 'LOAD_DRAFT', payload: newDraft });
        } catch (error) {
            console.error("Delete failed:", error);
            showToast("Could not delete draft.", "error");
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };


    if (isFormLoading) {
        return <div className="flex items-center justify-center h-96"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /><span className="ml-4 text-lg dark:text-gray-300">Loading ePRF...</span></div>;
    }

    if (!activeEvent) {
        return (
            <div className="text-center p-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-4">No Active Event</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Please log on to an event from the Events page before creating an ePRF.</p>
                <button onClick={() => navigate('/events')} className="px-6 py-3 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90">
                    Go to Events
                </button>
            </div>
        );
    }
    
    return (
        <div>
            <SaveStatusIndicator status={saveStatus} />
            <PatientModal isOpen={isPatientModalOpen} onClose={() => setPatientModalOpen(false)} onSave={handleSaveNewPatient} />
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Delete Draft ePRF" message="Are you sure you want to permanently delete this draft? This action cannot be undone." confirmText="Delete" isLoading={isDeleting}/>
            <ValidationModal isOpen={isValidationModalOpen} onClose={() => setValidationModalOpen(false)} errors={validationErrors} />

            {state.reviewNotes && (
                <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md dark:bg-yellow-900 dark:text-yellow-200">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-bold">Manager Review:</p>
                            <p>{state.reviewNotes}</p>
                        </div>
                        <button onClick={() => dispatch({ type: 'DISMISS_REVIEW_NOTES' })} className="font-bold text-2xl">&times;</button>
                    </div>
                </div>
            )}
            
            <form>
                <Section title="Incident & Timestamps">
                    <SelectField label="Presentation Type" name="presentationType" value={state.presentationType} onChange={handleChange} className="lg:col-span-2">
                        <option>Medical/Trauma</option>
                        <option>Minor Injury</option>
                        <option>Welfare/Intox</option>
                    </SelectField>
                    <InputField label="Incident #" name="incidentNumber" value={state.incidentNumber} onChange={handleChange} />
                    <InputField label="Incident Date" name="incidentDate" type="date" value={state.incidentDate} onChange={handleChange} />
                    <InputField label="Incident Time" name="incidentTime" type="time" value={state.incidentTime} onChange={handleChange} />
                    <InputField label="Location" name="incidentLocation" value={state.incidentLocation} onChange={handleChange} className="md:col-span-2 lg:col-span-3"/>
                    <InputField label="Time of Call" name="timeOfCall" type="time" value={state.timeOfCall} onChange={handleChange} />
                    <InputField label="On Scene Time" name="onSceneTime" type="time" value={state.onSceneTime} onChange={handleChange} />
                    <InputField label="At Patient Time" name="atPatientTime" type="time" value={state.atPatientTime} onChange={handleChange} />
                    <InputField label="Left Scene Time" name="leftSceneTime" type="time" value={state.leftSceneTime} onChange={handleChange} />
                    <InputField label="At Destination Time" name="atDestinationTime" type="time" value={state.atDestinationTime} onChange={handleChange} />
                    <InputField label="Clear Time" name="clearDestinationTime" type="time" value={state.clearDestinationTime} onChange={handleChange} />
                </Section>
                
                <Section title="Patient Demographics">
                    <FieldWrapper className="relative md:col-span-2 lg:col-span-3">
                        <label className={labelBaseClasses}>Search Existing Patient</label>
                        <input type="text" placeholder="Name or DOB..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className={inputBaseClasses} />
                        {searchLoading && <SpinnerIcon className="absolute right-3 top-9 w-5 h-5 text-gray-400" />}
                        {searchResults.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                                {searchResults.map(p => <li key={p.id} onClick={() => handleSelectPatient(p)} className="px-4 py-2 cursor-pointer hover:bg-ams-light-blue hover:text-white dark:text-gray-200">{p.firstName} {p.lastName} - {p.dob}</li>)}
                            </ul>
                        )}
                    </FieldWrapper>
                     <FieldWrapper className="flex items-end">
                        <button type="button" onClick={() => setPatientModalOpen(true)} className="w-full h-10 px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-5 h-5 inline mr-2"/>New Patient</button>
                    </FieldWrapper>
                     <InputField label="Patient Name" name="patientName" value={state.patientName} onChange={handleChange} required/>
                     <InputField label="Patient Age" name="patientAge" value={state.patientAge} onChange={handleChange} required/>
                     <SelectField label="Patient Gender" name="patientGender" value={state.patientGender} onChange={handleChange}>
                        <option>Unknown</option><option>Male</option><option>Female</option><option>Other</option>
                    </SelectField>
                </Section>

                <Section title="Clinical Assessment">
                    <SpeechEnabledTextArea label="Presenting Complaint / Situation" name="presentingComplaint" value={state.presentingComplaint} onChange={handleChange} />
                    <SpeechEnabledTextArea label="History of Complaint / Events" name="history" value={state.history} onChange={handleChange} />
                    <SpeechEnabledTextArea label="Mechanism of Injury" name="mechanismOfInjury" value={state.mechanismOfInjury ?? ''} onChange={handleChange} />
                    <TextAreaField label="Allergies" name="allergies" value={state.allergies} onChange={handleChange} rows={2}/>
                    <TextAreaField label="Current Medications" name="medications" value={state.medications} onChange={handleChange} rows={2}/>
                    <TextAreaField label="Past Medical History" name="pastMedicalHistory" value={state.pastMedicalHistory} onChange={handleChange} rows={2}/>
                </Section>

                {state.presentationType !== 'Welfare/Intox' &&
                    <>
                        <Section title="Primary Survey (ABCDE)">
                            <SpeechEnabledTextArea label="Airway" name="airway" value={state.airway} onChange={handleChange} rows={2} />
                            <SpeechEnabledTextArea label="Breathing" name="breathing" value={state.breathing} onChange={handleChange} rows={2} />
                            <SpeechEnabledTextArea label="Circulation" name="circulation" value={state.circulation} onChange={handleChange} rows={2} />
                            <SpeechEnabledTextArea label="Exposure" name="exposure" value={state.exposure} onChange={handleChange} rows={2} />
                        </Section>

                        <Section title="Disability">
                             <SelectField label="AVPU" name="avpu" value={state.disability.avpu} onChange={e => handleNestedChange('disability', 'avpu', e)}><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></SelectField>
                             <SelectField label="GCS Eyes" name="eyes" value={state.disability.gcs.eyes} onChange={handleGCSChange}><option value="4">4 - Spontaneous</option><option value="3">3 - To speech</option><option value="2">2 - To pain</option><option value="1">1 - None</option></SelectField>
                             <SelectField label="GCS Verbal" name="verbal" value={state.disability.gcs.verbal} onChange={handleGCSChange}><option value="5">5 - Orientated</option><option value="4">4 - Confused</option><option value="3">3 - Inappropriate words</option><option value="2">2 - Incomprehensible</option><option value="1">1 - None</option></SelectField>
                             <SelectField label="GCS Motor" name="motor" value={state.disability.gcs.motor} onChange={handleGCSChange}><option value="6">6 - Obeys commands</option><option value="5">5 - Localises pain</option><option value="4">4 - Withdraws from pain</option><option value="3">3 - Flexion to pain</option><option value="2">2 - Extension to pain</option><option value="1">1 - None</option></SelectField>
                             <div className="flex items-center justify-center p-4 bg-ams-blue dark:bg-ams-light-blue text-white dark:text-ams-blue rounded-lg font-bold text-xl lg:col-span-4 text-center">GCS Total: {state.disability.gcs.total}</div>
                             <TextAreaField label="Pupils" name="pupils" value={state.disability.pupils} onChange={e => handleNestedChange('disability', 'pupils', e)} rows={1} />
                        </Section>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                            <div className="flex justify-between items-center mb-4">
                               <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">Observations</h2>
                                <button type="button" onClick={addVitalSign} className="flex items-center px-3 py-1.5 text-sm bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/>Add Vitals</button>
                            </div>
                            <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700">{['Time', 'HR', 'RR', 'BP', 'SpO2', 'Temp', 'BG', 'Pain', 'O2', 'NEWS2', ''].map(h => <th key={h} className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {state.vitals.map((v, i) => (
                                        <tr key={i} className="border-b dark:border-gray-700">
                                            <td className="p-1"><input type="time" name="time" value={v.time} onChange={e => handleVitalChange(i, e)} className={`${inputBaseClasses} text-sm`}/></td>
                                            {[ 'hr', 'rr', 'bp', 'spo2', 'temp', 'bg', 'painScore' ].map(key => 
                                                <td key={key} className="p-1"><input type="text" name={key} value={v[key as keyof VitalSign] as string} onChange={e => handleVitalChange(i, e)} className={`${inputBaseClasses} text-sm`}/></td>
                                            )}
                                            <td className="p-1 text-center"><input type="checkbox" name="onOxygen" checked={v.onOxygen} onChange={e => handleVitalChange(i, e)} className="h-5 w-5 rounded"/></td>
                                            <td className="p-1 text-center"><span className={`px-2 py-1 font-bold rounded-full text-white text-sm ${getNews2RiskColor(v.news2)}`}>{v.news2 ?? '-'}</span></td>
                                            <td className="p-1 text-center"><button type="button" onClick={() => removeVitalSign(i)} aria-label="Remove vital sign" className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>

                         <Section title="Secondary Survey & Injuries">
                            <SpeechEnabledTextArea label="Further Assessment Findings" name="secondarySurvey" value={state.secondarySurvey} onChange={handleChange} />
                            <FieldWrapper className="md:col-span-2 lg:col-span-4">
                                <InteractiveBodyMap value={state.injuries} onChange={handleInjuriesChange} />
                            </FieldWrapper>
                        </Section>
                    </>
                }
                
                <Section title="Treatment & Disposition">
                    <FieldWrapper className="md:col-span-2 lg:col-span-4">
                        <ImpressionsInput value={state.impressions} onChange={(v) => dispatch({ type: 'UPDATE_FIELD', field: 'impressions', payload: v })} />
                    </FieldWrapper>

                    <FieldWrapper className="md:col-span-2 lg:col-span-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className={labelBaseClasses}>Medications Administered</h3>
                            <button type="button" onClick={() => addDynamicListItem('medicationsAdministered')} className="flex items-center px-3 py-1.5 text-sm bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/>Add Med</button>
                        </div>
                        <div className="space-y-2">
                        {state.medicationsAdministered.map((med, index) => {
                            const isRestricted = RESTRICTED_MEDICATIONS.includes(med.medication);
                            const canAuthorise = user && SENIOR_CLINICIAN_ROLES.includes(user.role) && state.crewMembers.some(cm => cm.uid === user.uid);
                            return (
                            <div key={med.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                <input type="time" name="time" value={med.time} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} col-span-4 md:col-span-2`} />
                                <input type="text" name="medication" placeholder="Medication" value={med.medication} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} col-span-8 md:col-span-3`} />
                                <input type="text" name="dose" placeholder="Dose" value={med.dose} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} col-span-4 md:col-span-2`} />
                                <select name="route" value={med.route} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} col-span-5 md:col-span-2`}>
                                    <option>PO</option><option>IV</option><option>IM</option><option>SC</option><option>SL</option><option>PR</option><option>Nebulised</option><option>Other</option>
                                </select>
                                <div className={`flex items-center justify-center ${isRestricted ? 'col-span-2 md:col-span-2' : 'col-span-3 md:col-span-2'}`}>
                                    {isRestricted && (
                                        med.authorisedBy ? (
                                            <div className="text-xs text-center text-green-700 dark:text-green-300"><p className="font-bold">Authorised</p><p>by {med.authorisedBy.name.split(' ')[0]}</p></div>
                                        ) : (
                                            canAuthorise ? (
                                                <button type="button" onClick={() => handleAuthoriseMed(index)} className="w-full px-2 py-1 text-sm bg-green-500 text-white font-semibold rounded-md hover:bg-green-600">Authorise</button>
                                            ) : (
                                                <p className="text-xs text-center text-yellow-600 dark:text-yellow-400 font-semibold">Pending Auth</p>
                                            )
                                        )
                                    )}
                                </div>
                                <button type="button" onClick={() => removeDynamicListItem('medicationsAdministered', index)} aria-label="Remove medication" className="text-red-500 hover:text-red-700 col-span-1 justify-self-end"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                            )
                        })}
                        </div>
                    </FieldWrapper>

                    <FieldWrapper className="md:col-span-2 lg:col-span-4">
                        <div className="flex justify-between items-center mb-2 mt-4">
                            <h3 className={labelBaseClasses}>Interventions</h3>
                            <button type="button" onClick={() => addDynamicListItem('interventions')} className="flex items-center px-3 py-1.5 text-sm bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/>Add Intervention</button>
                        </div>
                        <div className="space-y-2">
                        {state.interventions.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                <input type="time" name="time" value={item.time} onChange={e => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} col-span-3`} />
                                <input type="text" name="intervention" placeholder="Intervention" value={item.intervention} onChange={e => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} col-span-4`} />
                                <input type="text" name="details" placeholder="Details" value={item.details} onChange={e => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} col-span-4`} />
                                <button type="button" onClick={() => removeDynamicListItem('interventions', index)} aria-label="Remove intervention" className="text-red-500 hover:text-red-700 col-span-1 justify-self-end"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                        </div>
                    </FieldWrapper>

                    <FieldWrapper className="md:col-span-2 lg:col-span-4">
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-gray-700/50 rounded-lg border border-blue-200 dark:border-gray-600">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-ams-blue dark:text-ams-light-blue flex items-center gap-2">
                                    <SparklesIcon className="w-5 h-5" />
                                    AI Clinical Suggestions
                                </h3>
                                <button 
                                    type="button" 
                                    onClick={handleGetSuggestions} 
                                    disabled={isSuggesting || !isOnline}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-ams-light-blue rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center"
                                    title={!isOnline ? "AI suggestions require an internet connection." : ""}
                                >
                                    {isSuggesting ? <SpinnerIcon className="w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                                    {isSuggesting ? 'Thinking...' : 'Get Suggestions'}
                                </button>
                            </div>
                            {!isOnline && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">AI suggestions are disabled in offline mode.</p>}
                            
                            {suggestions && (
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-semibold text-gray-700 dark:text-gray-300">Suggested Impressions</h4>
                                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600 dark:text-gray-400">
                                            {suggestions.impressions.map((imp, i) => <li key={`imp-${i}`}>{imp}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-700 dark:text-gray-300">Suggested Interventions</h4>
                                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600 dark:text-gray-400">
                                            {suggestions.interventions.map((int, i) => <li key={`int-${i}`}>{int}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </FieldWrapper>

                    <SelectField label="Final Disposition" name="disposition" value={state.disposition} onChange={handleChange} className="lg:col-span-2">
                        <option value="Not Set">Not Set</option>
                        <option>Conveyed to ED</option>
                        <option>Left at Home (Own Consent)</option>
                        <option>Left at Home (Against Advice)</option>
                        <option>Referred to Other Service</option>
                        <option>Deceased on Scene</option>
                    </SelectField>

                    {state.disposition === 'Conveyed to ED' &&
                        <>
                            <InputField label="Destination" name="destination" value={state.dispositionDetails.destination} onChange={e => handleNestedChange('dispositionDetails', 'destination', e)} />
                            <InputField label="Receiving Clinician" name="receivingClinician" value={state.dispositionDetails.receivingClinician} onChange={e => handleNestedChange('dispositionDetails', 'receivingClinician', e)} />
                        </>
                    }
                     {state.disposition === 'Referred to Other Service' &&
                        <TextAreaField label="Referral Details" name="referralDetails" value={state.dispositionDetails.referralDetails} onChange={e => handleNestedChange('dispositionDetails', 'referralDetails', e)} />
                    }

                    <SpeechEnabledTextArea label="Handover Details" name="handoverDetails" value={state.handoverDetails} onChange={handleChange} />

                </Section>
                
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Safeguarding & Capacity</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <fieldset>
                             <legend className={labelBaseClasses}>Safeguarding Concerns</legend>
                             <div className="mt-2 space-y-2">
                                 {['Child', 'Adult', 'Domestic Abuse', 'Vulnerable Adult'].map(c => <CheckboxField key={c} label={c} name={c} checked={state.safeguarding.concerns.includes(c as any)} onChange={e => handleCheckboxArrayChange('safeguarding', 'concerns', e)} />)}
                             </div>
                             <textarea name="details" value={state.safeguarding.details} onChange={e => handleNestedChange('safeguarding', 'details', e)} rows={2} className={`${inputBaseClasses} mt-2`} placeholder="Details of concerns..."/>
                        </fieldset>
                         <fieldset>
                             <legend className={labelBaseClasses}>Mental Capacity Assessment</legend>
                             <div className="mt-2 space-y-2">
                                {['Understands', 'Retains', 'Weighs', 'Communicates'].map(c => <CheckboxField key={c} label={c} name={c} checked={state.mentalCapacity.assessment.includes(c as any)} onChange={e => handleCheckboxArrayChange('mentalCapacity', 'assessment', e)} />)}
                            </div>
                             <select name="outcome" value={state.mentalCapacity.outcome} onChange={e => handleNestedChange('mentalCapacity', 'outcome', e)} className={`${inputBaseClasses} mt-2`}>
                                <option>Not Assessed</option><option>Has Capacity</option><option>Lacks Capacity</option><option>Fluctuating</option>
                            </select>
                             <textarea name="details" value={state.mentalCapacity.details} onChange={e => handleNestedChange('mentalCapacity', 'details', e)} rows={2} className={`${inputBaseClasses} mt-2`} placeholder="Details of assessment..."/>
                        </fieldset>
                     </div>
                 </div>

                 {state.disposition === 'Left at Home (Against Advice)' &&
                     <Section title="Refusal of Care (Medico-Legal)">
                        <CheckboxField label="Patient has refused specific treatment" name="refusedTreatment" checked={state.refusalOfCare.refusedTreatment} onChange={e => handleNestedChange('refusalOfCare', 'refusedTreatment', e)} />
                        <CheckboxField label="Patient has refused transport to hospital" name="refusedTransport" checked={state.refusalOfCare.refusedTransport} onChange={e => handleNestedChange('refusalOfCare', 'refusedTransport', e)} />
                        <CheckboxField label="Patient has demonstrated capacity to refuse" name="capacityDemonstrated" checked={state.refusalOfCare.capacityDemonstrated} onChange={e => handleNestedChange('refusalOfCare', 'capacityDemonstrated', e)} />
                        <CheckboxField label="All risks have been explained to the patient" name="risksExplained" checked={state.refusalOfCare.risksExplained} onChange={e => handleNestedChange('refusalOfCare', 'risksExplained', e)} />
                        <TextAreaField label="Details of Refusal" name="details" value={state.refusalOfCare.details} onChange={e => handleNestedChange('refusalOfCare', 'details', e)} />
                    </Section>
                 }

                <Section title="Attachments">
                    <FieldWrapper className="md:col-span-2 lg:col-span-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {state.attachments.map((att) => (
                                <div key={att.id} className="relative group border rounded-lg p-2 dark:border-gray-700">
                                    <img src={att.base64Data} alt="Attachment" className="rounded-md w-full h-32 object-cover" />
                                    <input
                                        type="text"
                                        placeholder="Description..."
                                        value={att.description}
                                        onChange={(e) => handleAttachmentDescriptionChange(att.id, e.target.value)}
                                        className={`${inputBaseClasses} text-sm mt-2`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveAttachment(att.id)}
                                        aria-label="Remove attachment"
                                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <label className="flex flex-col items-center justify-center w-full h-full min-h-[160px] p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
                                <CameraIcon className="w-10 h-10 text-gray-400" />
                                <span className="mt-2 text-sm text-center text-gray-500 dark:text-gray-400">Add Photo</span>
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddAttachment} />
                            </label>
                        </div>
                    </FieldWrapper>
                </Section>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Crew Members</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                             <label className={labelBaseClasses}>Add Crew</label>
                            <div className="flex gap-2">
                                <select value={selectedCrewMember} onChange={e => setSelectedCrewMember(e.target.value)} className={inputBaseClasses}>
                                    <option value="">Select a staff member...</option>
                                    {allStaff.map(s => <option key={s.uid} value={s.uid}>{s.firstName} {s.lastName}</option>)}
                                </select>
                                <button type="button" onClick={handleAddCrewMember} className="px-4 bg-ams-blue text-white rounded-md hover:bg-opacity-90">Add</button>
                            </div>
                        </div>
                         <div>
                             <label className={labelBaseClasses}>Attending Crew</label>
                             <ul className="mt-2 space-y-2">
                                {state.crewMembers.map(c => (
                                    <li key={c.uid} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                        <span className="dark:text-gray-200">{c.name}</span>
                                        <button type="button" onClick={() => handleRemoveCrewMember(c.uid)} aria-label="Remove crew member" className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                                    </li>
                                ))}
                             </ul>
                        </div>
                     </div>
                </div>

                <div className="flex justify-between items-center mt-8">
                     <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700">
                        Delete Draft
                    </button>
                    <button type="button" onClick={handleFinalize} disabled={isSaving} className="px-8 py-4 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                        {isSaving && <SpinnerIcon className="w-6 h-6 mr-3" />}
                        {isSaving ? 'Finalizing...' : 'Finalize & Submit'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EPRF;