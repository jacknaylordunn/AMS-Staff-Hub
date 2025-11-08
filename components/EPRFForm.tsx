import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
// FIX: The error indicates Timestamp is not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import type { EPRFForm, Patient, VitalSign, MedicationAdministered, Intervention, Injury, WelfareLogEntry, User as AppUser, Attachment, EventLog } from '../types';
import { PlusIcon, TrashIcon, SpinnerIcon, CheckIcon, CameraIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, EventsIcon, SparklesIcon, QuestionMarkCircleIcon, ShieldExclamationIcon, DocsIcon } from './icons';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { searchPatients, addPatient } from '../services/patientService';
import { updateEPRF, finalizeEPRF, deleteEPRF, getIncidentNumber } from '../services/eprfService';
import { getEvents } from '../services/eventService';
import { getUsers } from '../services/userService';
import { uploadFile } from '../services/storageService';
import { showToast } from './Toast';
import PatientModal from './PatientModal';
import { calculateNews2Score, getNews2RiskColor } from '../utils/news2Calculator';
import { InteractiveBodyMap } from './InteractiveBodyMap';
import ConfirmationModal from './ConfirmationModal';
import SpeechEnabledTextArea from './SpeechEnabledTextArea';
import ValidationModal from './ValidationModal';
import TaggableInput from './TaggableInput';
import { DRUG_DATABASE } from '../utils/drugDatabase';
import SignaturePad, { SignaturePadRef } from './SignaturePad';
import VitalsChart from './VitalsChart';
import QuickAddModal from './QuickAddModal';
import GuidelineAssistantModal from './GuidelineAssistantModal';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../services/firebase';
import CameraModal from './CameraModal';

interface EPRFFormProps {
    initialEPRFData: EPRFForm;
    onComplete: () => void;
}

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
                ...(state[field as keyof EPRFForm] as object),
                [subField]: payload
            }
        };
    }
    case 'UPDATE_CHECKBOX_ARRAY': {
        const { field, subField, value, checked } = action;
        const parentObject = state[field as keyof EPRFForm];
        const currentArray = (parentObject as any)[subField] as string[] || [];
        
        const newArray = checked 
            ? [...currentArray, value]
            : currentArray.filter(item => item !== value);
        return {
             ...state,
            [field]: {
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
    case 'UPDATE_DYNAMIC_LIST': {
        const newState = { ...state, [action.listName]: action.payload };
        // Logic for restricted drugs can be added here
        return newState;
    }
    case 'SELECT_PATIENT':
        const age = action.payload.dob ? new Date().getFullYear() - new Date(action.payload.dob).getFullYear() : '';
        const stringToArray = (str: string | null | undefined): string[] => {
            if (!str) return [];
            return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
        };
        return {
            ...state,
            patientId: action.payload.id,
            patientName: `${action.payload.firstName} ${action.payload.lastName}`,
            patientAge: age.toString(),
            patientGender: action.payload.gender,
            allergies: stringToArray(action.payload.allergies),
            medications: stringToArray(action.payload.medications),
            pastMedicalHistory: action.payload.medicalHistory,
        };
    case 'CLEAR_PATIENT':
        return {
            ...state,
            patientId: null,
            patientName: '',
            patientAge: '',
            patientGender: 'Unknown',
            allergies: [],
            medications: [],
            pastMedicalHistory: '',
        };
    case 'CLEAR_FORM':
      return action.payload;
    default:
      return state;
  }
};

const Stepper: React.FC<{ steps: string[], currentStep: number, onStepClick: (step: number) => void }> = ({ steps, currentStep, onStepClick }) => (
    <nav aria-label="Progress">
        <ol role="list" className="flex items-center">
            {steps.map((step, stepIdx) => (
                <li key={step} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                    {stepIdx < currentStep - 1 ? (
                        <>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="h-0.5 w-full bg-ams-light-blue" />
                            </div>
                            <button onClick={() => onStepClick(stepIdx + 1)} className="relative flex h-8 w-8 items-center justify-center rounded-full bg-ams-light-blue hover:bg-ams-blue">
                                <CheckIcon className="h-5 w-5 text-white" aria-hidden="true" />
                                <span className="sr-only">{step}</span>
                            </button>
                        </>
                    ) : stepIdx === currentStep - 1 ? (
                        <>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700" />
                            </div>
                            <button onClick={() => onStepClick(stepIdx + 1)} className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-ams-light-blue bg-white dark:bg-gray-800" aria-current="step">
                                <span className="h-2.5 w-2.5 rounded-full bg-ams-light-blue" aria-hidden="true" />
                                <span className="sr-only">{step}</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700" />
                            </div>
                            <button onClick={() => onStepClick(stepIdx + 1)} className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-transparent group-hover:bg-gray-300" aria-hidden="true" />
                                <span className="sr-only">{step}</span>
                            </button>
                        </>
                    )}
                     <span className="absolute top-10 -left-2 w-20 text-center text-xs text-gray-500 dark:text-gray-400">{step}</span>
                </li>
            ))}
        </ol>
    </nav>
);

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
const labelBaseClasses = "block text-sm font-medium text-gray-700 dark:text-gray-400";

const InputField: React.FC<{ label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean; className?: string; list?: string }> = 
({ label, name, value, onChange, type = 'text', required = false, className, list }) => (
  <FieldWrapper className={className}>
    <label htmlFor={name} className={labelBaseClasses}>{label}</label>
    <input type={type} id={name} name={name} value={value} onChange={onChange} required={required} className={inputBaseClasses} list={list} />
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
const commonItemsUsed = ['Large Dressing', 'Gauze', 'Triangular Bandage', 'Wound Closure Strips', 'Saline Pod', 'Catastrophic Tourniquet', 'Air-sickness Bag', 'Ice Pack'];

const dataURLtoBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error("Invalid data URL");
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

const EPRFForm: React.FC<EPRFFormProps> = ({ initialEPRFData, onComplete }) => {
    const { user } = useAuth();
    const { isOnline } = useOnlineStatus();
    const navigate = ReactRouterDOM.useNavigate();
    
    const clinicianSigRef = useRef<SignaturePadRef>(null);
    const patientSigRef = useRef<SignaturePadRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [state, dispatch] = useReducer(eprfReducer, initialEPRFData);
    
    const [patientSearch, setPatientSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPatientModalOpen, setPatientModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isValidationModalOpen, setValidationModalOpen] = useState(false);
    const [isQuickAddOpen, setQuickAddOpen] = useState(false);
    const [isGuidelineModalOpen, setGuidelineModalOpen] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isCameraModalOpen, setCameraModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [allStaff, setAllStaff] = useState<AppUser[]>([]);
    const [availableEvents, setAvailableEvents] = useState<EventLog[]>([]);
    const [selectedCrewMember, setSelectedCrewMember] = useState<string>('');
    const [currentStep, setCurrentStep] = useState(1);
    
    const [isSafeguardingModalOpen, setSafeguardingModalOpen] = useState(false);
    const [safeguardingCheckResult, setSafeguardingCheckResult] = useState('');
    const [isCheckingSafeguarding, setIsCheckingSafeguarding] = useState(false);

    const formSteps = {
        'Medical/Trauma': ['Incident', 'Patient', 'Assessment', 'Vitals & Injuries', 'Treatment', 'Disposition'],
        'Minor Injury': ['Incident', 'Patient', 'Injury Assessment', 'Disposition'],
        'Welfare/Intox': ['Incident', 'Patient', 'Welfare Log', 'Disposition'],
    };

    const steps = formSteps[state.presentationType] || formSteps['Medical/Trauma'];

    useEffect(() => {
        getUsers().then(setAllStaff);
        if (!state.eventId) {
            getEvents().then(events => setAvailableEvents(events.filter(e => e.status !== 'Completed')));
        }
    }, [state.eventId]);

    useEffect(() => {
        if (state.status !== 'Draft') return;
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
    }, [state, isOnline]);
    
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
            handleSelectPatient({ ...newPatient, id: patientId, createdAt: firestore.Timestamp.now() });
            showToast('Patient created successfully.', 'success');
            setPatientModalOpen(false);
        } catch (error) {
            console.error(error);
            showToast('Failed to create patient.', 'error');
        }
    };

    const handleSetTimeToNow = (fieldName: keyof EPRFForm) => () => {
        const timeString = new Date().toTimeString().split(' ')[0].substring(0, 5);
        dispatch({ type: 'UPDATE_FIELD', field: fieldName, payload: timeString });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'presentationType') setCurrentStep(1);
        dispatch({ type: 'UPDATE_FIELD', field: name, payload: value });
    };

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
        if (listName === 'medicationsAdministered') newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), medication: '', dose: '', route: 'PO' as const };
        else if (listName === 'interventions') newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), intervention: '', details: '' };
        else newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), observation: '' };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: [...state[listName], newItem]});
    }
    const removeDynamicListItem = (listName: 'medicationsAdministered' | 'interventions' | 'welfareLog', index: number) => {
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: state[listName].filter((_, i) => i !== index)});
    }
    
     const handleQuickAdd = (type: 'vital' | 'med' | 'int', data: any) => {
        if (type === 'vital') {
            const newVitals = [...state.vitals, data].sort((a, b) => a.time.localeCompare(b.time));
            dispatch({ type: 'UPDATE_VITALS', payload: newVitals });
        } else if (type === 'med') {
            const newList = [...state.medicationsAdministered, data].sort((a, b) => a.time.localeCompare(b.time));
            dispatch({ type: 'UPDATE_DYNAMIC_LIST', listName: 'medicationsAdministered', payload: newList });
        } else if (type === 'int') {
            const newList = [...state.interventions, data].sort((a, b) => a.time.localeCompare(b.time));
            dispatch({ type: 'UPDATE_DYNAMIC_LIST', listName: 'interventions', payload: newList });
        }
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} added.`, 'success');
    };

    const handleInjuriesChange = (newInjuries: Injury[]) => {
        dispatch({ type: 'UPDATE_INJURIES', payload: newInjuries });
    };
    
    const uploadAndAddAttachment = async (file: File | Blob, fileName: string) => {
        setIsUploading(true);
        try {
            const filePath = `attachments/${state.id}/${Date.now()}_${fileName}`;
            const url = await uploadFile(file, filePath);
            const newAttachment: Attachment = { id: Date.now().toString(), url, fileName, mimeType: file.type, description: '' };
            dispatch({ type: 'UPDATE_ATTACHMENTS', payload: [...state.attachments, newAttachment] });
            showToast("File uploaded successfully.", "success");
        } catch (error) {
            showToast("File upload failed.", "error");
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach(file => uploadAndAddAttachment(file, file.name));
        }
    };

    const handlePhotoCaptured = (blob: Blob) => {
        const fileName = `photo_${Date.now()}.jpg`;
        uploadAndAddAttachment(blob, fileName);
    };

    const removeAttachment = (id: string) => {
        // Note: This doesn't delete the file from storage, only removes the reference.
        // A more robust solution would involve a cloud function for deletions.
        dispatch({ type: 'UPDATE_ATTACHMENTS', payload: state.attachments.filter(att => att.id !== id) });
    };


    const handleAddCrewMember = () => {
        if (!selectedCrewMember) return;
        const member = allStaff.find(s => s.uid === selectedCrewMember);
        if (member && !state.crewMembers.some(c => c.uid === member.uid)) {
            const newCrew = [...state.crewMembers, { uid: member.uid, name: `${member.firstName} ${member.lastName}` }];
            dispatch({ type: 'UPDATE_FIELD', field: 'crewMembers', payload: newCrew });
            setSelectedCrewMember('');
        }
    };
    const handleRemoveCrewMember = (uid: string) => {
        if (uid === user?.uid) {
            showToast("You cannot remove yourself from the crew.", "error");
            return;
        }
        const newCrew = state.crewMembers.filter(c => c.uid !== uid);
        dispatch({ type: 'UPDATE_FIELD', field: 'crewMembers', payload: newCrew });
    };
    
    const handleGenerateIncidentNumber = async () => {
        if (state.incidentNumber) return; 
        setIsSaving(true);
        try {
            const newIncidentNumber = await getIncidentNumber();
            dispatch({ type: 'UPDATE_FIELD', field: 'incidentNumber', payload: newIncidentNumber });
            showToast("Incident number generated.", "success");
        } catch (error) {
            showToast("Failed to generate incident number.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const validateForm = (): boolean => {
        const errors: string[] = [];
        if (!state.eventId) errors.push("An event must be selected for this report.");
        if (!state.patientName.trim()) errors.push("Patient name is required.");
        if (!state.incidentNumber.trim()) errors.push("Incident Number must be generated.");
        if (!state.incidentDate || !state.incidentTime) errors.push("Incident date and time are required.");
        if (state.presentationType !== 'Welfare/Intox' && !state.presentingComplaint.trim()) errors.push("Presenting complaint is required for this presentation type.");
        if (state.disposition === 'Not Set') errors.push("Final patient disposition must be selected.");
        if (state.disposition === 'Conveyed to ED' && !state.dispositionDetails.destination.trim()) errors.push("Destination is required when conveying to ED.");
        
        if (errors.length > 0) {
            setValidationErrors(errors);
            setValidationModalOpen(true);
            return false;
        }
        return true;
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        try {
            await deleteEPRF(state.id!);
            showToast("Draft deleted.", "success");
            onComplete(); 
        } catch (error) {
            showToast("Failed to delete draft.", "error");
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    const handleFinalize = async () => {
        if (!validateForm()) return;
        setIsSaving(true);
        setSaveStatus('saving');
        try {
            const clinicianSignatureUrl = clinicianSigRef.current?.getSignature();
            const patientSignatureUrl = patientSigRef.current?.getSignature();
            let finalState = {...state};
            let signaturesNeedSync = false;
            if (clinicianSignatureUrl) {
                finalState.clinicianSignatureUrl = clinicianSignatureUrl;
                if (!isOnline) signaturesNeedSync = true;
            }
            if (patientSignatureUrl) {
                finalState.patientSignatureUrl = patientSignatureUrl;
                if (!isOnline) signaturesNeedSync = true;
            }
            finalState.signaturesNeedSync = signaturesNeedSync;
            await finalizeEPRF(state.id!, finalState);
            showToast("ePRF submitted for review.", "success");
            onComplete();
        } catch (error) {
            console.error("Failed to finalize ePRF:", error);
            showToast("Failed to finalize ePRF.", "error");
        } finally {
            setIsSaving(false);
            setSaveStatus('idle');
        }
    };
    
    const handleGenerateSummary = async () => {
        setIsSummarizing(true);
        showToast("Generating handover summary...", "info");
        const functions = getFunctions(app);
        const askClinicalAssistant = httpsCallable<{ query: string }, { response: string }>(functions, 'askClinicalAssistant');
        try {
            const systemInstruction = "You are a clinical assistant. Summarize the provided ePRF JSON data into a concise SBAR (Situation, Background, Assessment, Recommendation) handover report suitable for a hospital emergency department. Focus on clinically relevant information. Be clear and direct.";
            const context = {
                presentation: state.presentingComplaint, history: state.history,
                vitals: state.vitals.slice(-2), findings: state.secondarySurvey,
                treatment: state.medicationsAdministered.map(m => `${m.medication} ${m.dose}`).join(', ') + '; ' + state.interventions.map(i => i.intervention).join(', '),
                allergies: state.allergies, medications: state.medications,
            };
            const prompt = `${systemInstruction}\n\nGenerate an SBAR handover for this patient: ${JSON.stringify(context)}`;
            const result = await askClinicalAssistant({ query: prompt });
            dispatch({ type: 'UPDATE_FIELD', field: 'handoverDetails', payload: result.data.response });
            showToast("Handover summary generated.", "success");
        } catch (err) {
            console.error("Cloud function for summary generation failed:", err);
            showToast("Failed to generate summary.", "error");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleSafeguardingCheck = async () => {
        const narrative = `Complaint: ${state.presentingComplaint}. History: ${state.history}. Safeguarding details: ${state.safeguarding.details}.`;
        if (narrative.length < 50) {
            showToast("Please provide more clinical details before running the check.", "info");
            return;
        }
        setIsCheckingSafeguarding(true);
        setSafeguardingCheckResult('');
        const functions = getFunctions(app);
        const askClinicalAssistant = httpsCallable<{ query: string }, { response: string }>(functions, 'askClinicalAssistant');
        try {
            const prompt = `Analyze the following anonymized clinical narrative for any potential safeguarding indicators (child, adult, domestic abuse, vulnerable adult). Provide a brief summary of potential concerns. If none, state "No obvious safeguarding concerns identified". Narrative: ${narrative}`;
            const result = await askClinicalAssistant({ query: prompt });
            setSafeguardingCheckResult(result.data.response);
        } catch (err) {
            setSafeguardingCheckResult("An error occurred while checking. Please try again.");
        } finally {
            setIsCheckingSafeguarding(false);
        }
    };

    return (
        <form onSubmit={e => e.preventDefault()} className="pb-20">
            <div className="p-4 bg-white dark:bg-gray-800 shadow-md mb-6 sticky top-[80px] z-20">
                 <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />
            </div>

            <SaveStatusIndicator status={saveStatus} />
            <PatientModal isOpen={isPatientModalOpen} onClose={() => setPatientModalOpen(false)} onSave={handleSaveNewPatient} />
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Delete ePRF Draft" message="Are you sure you want to permanently delete this ePRF draft?" confirmText="Delete" isLoading={isDeleting} />
            <ValidationModal isOpen={isValidationModalOpen} onClose={() => setValidationModalOpen(false)} errors={validationErrors} />
            <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setQuickAddOpen(false)} onSave={handleQuickAdd} />
            <GuidelineAssistantModal isOpen={isGuidelineModalOpen} onClose={() => setGuidelineModalOpen(false)} />
            <CameraModal isOpen={isCameraModalOpen} onClose={() => setCameraModalOpen(false)} onCapture={handlePhotoCaptured} />
            
            <ConfirmationModal
                isOpen={isSafeguardingModalOpen}
                onClose={() => setSafeguardingModalOpen(false)}
                onConfirm={handleSafeguardingCheck}
                title="AI Safeguarding Check"
                message="This tool will analyze the clinical narrative for potential safeguarding indicators. Do not include patient identifiable information in your notes. This is an advisory tool and does not replace clinical judgment."
                confirmText="Run Check"
                isLoading={isCheckingSafeguarding}
            >
                {safeguardingCheckResult && (
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <p className="font-semibold">AI Assistant Response:</p>
                        <p className="text-sm">{safeguardingCheckResult}</p>
                    </div>
                )}
            </ConfirmationModal>

            {state.reviewNotes && (
                 <div className="p-4 mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-md">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-bold">Manager's Note for Correction:</p>
                            <p>{state.reviewNotes}</p>
                        </div>
                        <button onClick={() => dispatch({ type: 'DISMISS_REVIEW_NOTES' })} className="text-sm font-bold">Dismiss</button>
                    </div>
                </div>
            )}
            
            <div className={steps[currentStep-1] === 'Incident' ? 'block' : 'hidden'}>
                <Section title="Incident & Triage">
                    {!state.eventId ? (
                        <SelectField label="* Select Event" name="eventId" value={state.eventId || ''} onChange={handleChange} className="md:col-span-2">
                            <option value="">-- Please select an event --</option>
                            {availableEvents.map(event => <option key={event.id} value={event.id}>{event.name} ({event.date})</option>)}
                        </SelectField>
                    ) : (
                        <InputField label="Event Name" name="eventName" value={state.eventName || ''} onChange={handleChange} className="md:col-span-2" />
                    )}
                    <SelectField label="Presentation Type" name="presentationType" value={state.presentationType} onChange={handleChange}>
                        <option>Medical/Trauma</option>
                        <option>Minor Injury</option>
                        <option>Welfare/Intox</option>
                    </SelectField>
                    <div className="relative">
                        <label className={labelBaseClasses}>Incident Number</label>
                        <input type="text" value={state.incidentNumber} readOnly className={`${inputBaseClasses} pr-24 bg-gray-100 dark:bg-gray-700/50`} placeholder="Click to generate..."/>
                        <button onClick={handleGenerateIncidentNumber} disabled={!!state.incidentNumber || isSaving} className="absolute right-1 top-7 px-3 py-1 text-xs bg-ams-light-blue text-white rounded-md disabled:bg-gray-400">
                           {isSaving ? <SpinnerIcon className="w-4 h-4" /> : 'Generate'}
                        </button>
                    </div>
                </Section>
                 <Section title="Event & Timestamps">
                    <InputField label="Location" name="incidentLocation" value={state.incidentLocation} onChange={handleChange} className="md:col-span-4" />
                    <InputField label="Incident Date" name="incidentDate" value={state.incidentDate} onChange={handleChange} type="date" />
                    <div className="relative"><label className={labelBaseClasses}>Incident Time</label><input type="time" name="incidentTime" value={state.incidentTime} onChange={handleChange} className={inputBaseClasses} /><button onClick={handleSetTimeToNow('incidentTime')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button></div>
                    <div className="relative md:col-span-1"><label className={labelBaseClasses}>Time of Call</label><input type="time" name="timeOfCall" value={state.timeOfCall || ''} onChange={handleChange} className={inputBaseClasses} /><button onClick={handleSetTimeToNow('timeOfCall')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button></div>
                    <div className="relative md:col-span-1"><label className={labelBaseClasses}>On Scene Time</label><input type="time" name="onSceneTime" value={state.onSceneTime || ''} onChange={handleChange} className={inputBaseClasses} /><button onClick={handleSetTimeToNow('onSceneTime')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button></div>
                </Section>
            </div>

            <div className={steps[currentStep-1] === 'Patient' ? 'block' : 'hidden'}>
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

                    <InputField label="Patient Name" name="patientName" value={state.patientName} onChange={handleChange} required className="md:col-span-2" />
                    <InputField label="Patient Age" name="patientAge" value={state.patientAge} onChange={handleChange} required />
                    <SelectField label="Patient Gender" name="patientGender" value={state.patientGender} onChange={handleChange}>
                        <option>Unknown</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                    </SelectField>
                </Section>
            </div>
            
            {/* ... other steps with conditional rendering ... */}

             <div className={steps[currentStep-1] === 'Disposition' ? 'block' : 'hidden'}>
                {/* ... other fields in disposition ... */}
                 <Section title="Safeguarding">
                    <div className="md:col-span-4 lg:col-span-2 space-y-2">
                        <label className={labelBaseClasses}>Safeguarding Concerns</label>
                        {['Child', 'Adult', 'Domestic Abuse', 'Vulnerable Adult'].map(concern => (
                            <CheckboxField key={concern} label={concern} name={concern} checked={state.safeguarding.concerns.includes(concern as any)} onChange={(e) => handleCheckboxArrayChange('safeguarding', 'concerns', e)} />
                        ))}
                    </div>
                    <div className="md:col-span-4 lg:col-span-2 space-y-4">
                        <SpeechEnabledTextArea label="Safeguarding Details" name="details" value={state.safeguarding.details} onChange={(e) => handleNestedChange('safeguarding', 'details', e)} rows={4} className="md:col-span-4"/>
                        <button type="button" onClick={() => { setSafeguardingCheckResult(''); setSafeguardingModalOpen(true); }} className="flex items-center text-sm px-3 py-2 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200">
                            <ShieldExclamationIcon className="w-5 h-5 mr-2"/> AI Safeguarding Check
                        </button>
                    </div>
                </Section>
                <Section title="Attachments">
                    <div className="md:col-span-4">
                        <label className={labelBaseClasses}>Upload Files or Photos</label>
                        <div className="mt-2 flex items-center gap-4">
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md text-sm font-semibold flex items-center">
                               {isUploading ? <SpinnerIcon className="w-5 h-5 mr-2"/> : <DocsIcon className="w-5 h-5 mr-2"/>} Upload File
                            </button>
                            <input type="file" multiple ref={fileInputRef} onChange={handleFileSelected} className="hidden" />
                            <button type="button" onClick={() => setCameraModalOpen(true)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md text-sm font-semibold flex items-center">
                                <CameraIcon className="w-5 h-5 mr-2"/> Take Photo
                            </button>
                        </div>
                         {state.attachments.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                {state.attachments.map(att => (
                                    <div key={att.id} className="relative group">
                                        <a href={att.url} target="_blank" rel="noopener noreferrer">
                                        {att.mimeType.startsWith('image/') ? (
                                            <img src={att.url} alt={att.fileName} className="w-full h-32 object-cover rounded-md" />
                                        ) : (
                                            <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-md flex flex-col items-center justify-center p-2">
                                                <DocsIcon className="w-10 h-10 text-gray-400" />
                                                <p className="text-xs text-center mt-2 text-gray-500 truncate">{att.fileName}</p>
                                            </div>
                                        )}
                                        </a>
                                        <button onClick={() => removeAttachment(att.id)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Section>
             </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 flex justify-between items-center shadow-lg md:pl-72 z-40">
                <div className="flex gap-2 items-center">
                    <button type="button" onClick={() => setIsDeleteModalOpen(true)} disabled={isDeleting} className="p-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full hover:bg-red-200">
                        {isDeleting ? <SpinnerIcon className="w-5 h-5" /> : <TrashIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setCurrentStep(s => Math.max(1, s - 1))} disabled={currentStep === 1} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50 flex items-center"><ChevronLeftIcon className="w-5 h-5 mr-1"/> Prev</button>
                    <button onClick={() => setCurrentStep(s => Math.min(steps.length, s + 1))} disabled={currentStep === steps.length} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50 flex items-center">Next <ChevronRightIcon className="w-5 h-5 ml-1"/></button>
                </div>
                <div className="text-sm text-gray-500 hidden md:block">Step {currentStep} of {steps.length}: {steps[currentStep-1]}</div>
                <div className="flex gap-2">
                     <button type="button" onClick={() => setGuidelineModalOpen(true)} className="hidden sm:flex items-center px-4 py-2 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-md"><SparklesIcon className="w-5 h-5 mr-2"/> Guidelines</button>
                     <button type="button" onClick={() => setQuickAddOpen(true)} className="flex items-center px-4 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-md"><PlusIcon className="w-5 h-5 mr-2"/> Quick Add</button>
                    {currentStep === steps.length && (
                        <button onClick={handleFinalize} disabled={isSaving || state.status !== 'Draft'} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md disabled:bg-gray-400 flex items-center">
                            {isSaving ? <SpinnerIcon className="w-5 h-5 mr-2" /> : <CheckIcon className="w-5 h-5 mr-2" />}
                            Finalize
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
};

export default EPRFForm;