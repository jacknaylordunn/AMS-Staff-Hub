import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
// FIX: The error indicates Timestamp is not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import type { EPRFForm, Patient, VitalSign, MedicationAdministered, Intervention, Injury, WelfareLogEntry, User as AppUser, Attachment, EventLog } from '../types';
import { PlusIcon, TrashIcon, SpinnerIcon, CheckIcon, CameraIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, EventsIcon, SparklesIcon, QuestionMarkCircleIcon, ShieldExclamationIcon } from './icons';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { searchPatients, addPatient } from '../services/patientService';
import { updateEPRF, finalizeEPRF, deleteEPRF, getIncidentNumber } from '../services/eprfService';
import { getEvents } from '../services/eventService';
import { getUsers } from '../services/userService';
import { uploadFile } from '../services/storageService';
import { showToast } from '../components/Toast';
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
// FIX: Removed import from deprecated geminiService and added imports for Firebase Functions
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../services/firebase';

interface EPRFFormProps {
    initialEPRFData: EPRFForm;
    onComplete: () => void;
}

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
        if (action.listName === 'medicationsAdministered') {
            const hasRestricted = (action.payload as MedicationAdministered[]).some(med => 
                RESTRICTED_MEDICATIONS.some(restricted => med.medication.includes(restricted))
            );
            newState.containsRestrictedDrugs = hasRestricted;
        }
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
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [allStaff, setAllStaff] = useState<AppUser[]>([]);
    const [availableEvents, setAvailableEvents] = useState<EventLog[]>([]);
    const [selectedCrewMember, setSelectedCrewMember] = useState<string>('');
    const [currentStep, setCurrentStep] = useState(1);
    const [showSafeguardingPrompt, setShowSafeguardingPrompt] = useState(false);
    const [safeguardingCheckText, setSafeguardingCheckText] = useState('');

    const formSteps = {
        'Medical/Trauma': ['Incident', 'Patient', 'Assessment', 'Vitals & Injuries', 'Treatment', 'Disposition & Signatures'],
        'Minor Injury': ['Incident', 'Patient', 'Injury Assessment', 'Disposition & Signatures'],
        'Welfare/Intox': ['Incident', 'Patient', 'Welfare Log', 'Disposition & Signatures'],
    };

    const steps = formSteps[state.presentationType] || formSteps['Medical/Trauma'];

    useEffect(() => {
        getUsers().then(setAllStaff);
        // Fetch events if the form is created without one
        if (!state.eventId) {
            getEvents().then(events => {
                const activeOrUpcoming = events.filter(e => e.status !== 'Completed');
                setAvailableEvents(activeOrUpcoming);
            });
        }
    }, [state.eventId]);

    // Auto-save form
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

    const handleSetTimeToNowNested = (field: string, subField: string) => () => {
        const timeString = new Date().toTimeString().split(' ')[0].substring(0, 5);
        dispatch({ type: 'UPDATE_NESTED_FIELD', field, subField, payload: timeString });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'eventId') {
            const selectedEvent = availableEvents.find(event => event.id === value);
            if (selectedEvent) {
                dispatch({ type: 'UPDATE_FIELD', field: 'eventId', payload: value });
                dispatch({ type: 'UPDATE_FIELD', field: 'eventName', payload: selectedEvent.name });
                dispatch({ type: 'UPDATE_FIELD', field: 'incidentLocation', payload: selectedEvent.location });
            } else {
                dispatch({ type: 'UPDATE_FIELD', field: 'eventId', payload: '' });
                dispatch({ type: 'UPDATE_FIELD', field: 'eventName', payload: '' });
            }
            return; 
        }

        if (name === 'presentationType') {
            setCurrentStep(1);
        }
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
    
    // Placeholder for handleAttachmentChange
    const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        showToast("Attachment uploads are not fully implemented yet.", "info");
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
        if (state.incidentNumber) return; // Don't generate if one already exists
        
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
            // Get signatures
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
        // FIX: Use Firebase Cloud Function for Gemini API calls
        const functions = getFunctions(app);
        const askClinicalAssistant = httpsCallable<{ query: string }, { response: string }>(functions, 'askClinicalAssistant');

        try {
            const systemInstruction = "You are a clinical assistant. Summarize the provided ePRF JSON data into a concise SBAR (Situation, Background, Assessment, Recommendation) handover report suitable for a hospital emergency department. Focus on clinically relevant information. Be clear and direct.";
            
            // Create a simplified, anonymized version for the prompt
            const context = {
                presentation: state.presentingComplaint,
                history: state.history,
                vitals: state.vitals.slice(-2), // last 2 sets
                findings: state.secondarySurvey,
                treatment: state.medicationsAdministered.map(m => `${m.medication} ${m.dose}`).join(', ') + '; ' + state.interventions.map(i => i.intervention).join(', '),
                allergies: state.allergies,
                medications: state.medications,
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
    
    const handleSafeguardingCheck = async () => {};

    return (
        <form onSubmit={e => e.preventDefault()} className="pb-20">
            <SaveStatusIndicator status={saveStatus} />
            <PatientModal isOpen={isPatientModalOpen} onClose={() => setPatientModalOpen(false)} onSave={handleSaveNewPatient} />
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Delete ePRF Draft" message="Are you sure you want to permanently delete this ePRF draft?" confirmText="Delete" isLoading={isDeleting} />
            <ValidationModal isOpen={isValidationModalOpen} onClose={() => setValidationModalOpen(false)} errors={validationErrors} />
            <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setQuickAddOpen(false)} onSave={handleQuickAdd} />
            <GuidelineAssistantModal isOpen={isGuidelineModalOpen} onClose={() => setGuidelineModalOpen(false)} />

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

            {steps[currentStep - 1] === 'Incident' && (
                <>
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
                    <div className="relative">
                         <label className={labelBaseClasses}>Incident Time</label>
                        <input type="time" name="incidentTime" value={state.incidentTime} onChange={handleChange} className={inputBaseClasses} />
                        <button onClick={handleSetTimeToNow('incidentTime')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button>
                    </div>
                    
                    <div className="relative md:col-span-1">
                         <label className={labelBaseClasses}>Time of Call</label>
                        <input type="time" name="timeOfCall" value={state.timeOfCall || ''} onChange={handleChange} className={inputBaseClasses} />
                         <button onClick={handleSetTimeToNow('timeOfCall')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button>
                    </div>
                     <div className="relative md:col-span-1">
                         <label className={labelBaseClasses}>On Scene Time</label>
                        <input type="time" name="onSceneTime" value={state.onSceneTime || ''} onChange={handleChange} className={inputBaseClasses} />
                         <button onClick={handleSetTimeToNow('onSceneTime')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button>
                    </div>
                </Section>
                </>
            )}

            {steps[currentStep - 1] === 'Patient' && (
                <Section title="Patient Information">
                    <div className="relative md:col-span-4">
                        <label className={labelBaseClasses}>Search Existing Patient</label>
                        <div className="flex gap-2">
                            <input type="search" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search by name or DOB..." className={inputBaseClasses}/>
                            <button type="button" onClick={() => setPatientModalOpen(true)} className="px-4 py-2 bg-ams-blue text-white rounded-md text-sm">New Patient</button>
                        </div>
                        {searchLoading && <SpinnerIcon className="absolute top-9 right-32" />}
                        {searchResults.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border rounded-md shadow-lg max-h-60 overflow-auto">
                                {searchResults.map(p => <li key={p.id} onClick={() => handleSelectPatient(p)} className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">{p.firstName} {p.lastName} - {p.dob}</li>)}
                            </ul>
                        )}
                    </div>
                    {state.patientId && <div className="md:col-span-4 p-2 bg-green-100 dark:bg-green-900/50 rounded flex justify-between items-center"><p>Patient record selected: <strong>{state.patientName}</strong></p><button onClick={() => dispatch({type: 'CLEAR_PATIENT'})} className="text-sm font-bold">Clear</button></div>}
                    <InputField label="Patient Name" name="patientName" value={state.patientName} onChange={handleChange} required className="md:col-span-2"/>
                    <InputField label="Age" name="patientAge" value={state.patientAge} onChange={handleChange} />
                    <SelectField label="Gender" name="patientGender" value={state.patientGender} onChange={handleChange}>
                        <option>Unknown</option><option>Male</option><option>Female</option><option>Other</option>
                    </SelectField>
                </Section>
            )}
            
            {/* Medical/Trauma Steps */}
            {state.presentationType === 'Medical/Trauma' && steps[currentStep - 1] === 'Assessment' && (
                <>
                <Section title="Presenting Complaint & History (SAMPLE)">
                    <SpeechEnabledTextArea label="Presenting Complaint / Situation" name="presentingComplaint" value={state.presentingComplaint} onChange={handleChange} rows={3} />
                    <SpeechEnabledTextArea label="History of Presenting Complaint" name="history" value={state.history} onChange={handleChange} rows={5} />
                    <SpeechEnabledTextArea label="Mechanism of Injury" name="mechanismOfInjury" value={state.mechanismOfInjury || ''} onChange={handleChange} rows={3} />
                    <TaggableInput label="Allergies" value={state.allergies} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'allergies', payload: v})} suggestions={['NKDA']} placeholder="e.g., Penicillin, NKDA" />
                    <TaggableInput label="Medications" value={state.medications} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'medications', payload: v})} suggestions={DRUG_DATABASE} placeholder="e.g., Aspirin, Salbutamol" />
                    <InputField label="Past Medical History" name="pastMedicalHistory" value={state.pastMedicalHistory} onChange={handleChange} className="md:col-span-2"/>
                    <InputField label="Last Oral Intake" name="lastOralIntake" value={state.lastOralIntake} onChange={handleChange} className="md:col-span-2"/>
                </Section>
                <Section title="Primary Survey (ABCDE)">
                     <InputField label="Airway" name="airway" value={state.airway} onChange={handleChange} />
                    <InputField label="Breathing" name="breathing" value={state.breathing} onChange={handleChange} />
                    <InputField label="Circulation" name="circulation" value={state.circulation} onChange={handleChange} />
                    <InputField label="Exposure" name="exposure" value={state.exposure} onChange={handleChange} />
                </Section>
                 <Section title="Disability (GCS)">
                    <SelectField label="AVPU" name="avpu" value={state.disability.avpu} onChange={e => handleNestedChange('disability', 'avpu', e)}><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></SelectField>
                    <SelectField label="Eyes" name="eyes" value={state.disability.gcs.eyes} onChange={handleGCSChange}><option value={4}>4 - Spontaneous</option><option value={3}>3 - To Speech</option><option value={2}>2 - To Pain</option><option value={1}>1 - None</option></SelectField>
                    <SelectField label="Verbal" name="verbal" value={state.disability.gcs.verbal} onChange={handleGCSChange}><option value={5}>5 - Orientated</option><option value={4}>4 - Confused</option><option value={3}>3 - Inappropriate</option><option value={2}>2 - Incomprehensible</option><option value={1}>1 - None</option></SelectField>
                    <SelectField label="Motor" name="motor" value={state.disability.gcs.motor} onChange={handleGCSChange}><option value={6}>6 - Obeys Commands</option><option value={5}>5 - Localises Pain</option><option value={4}>4 - Withdraws</option><option value={3}>3 - Flexion</option><option value={2}>2 - Extension</option><option value={1}>1 - None</option></SelectField>
                    <InputField label="GCS Total" name="total" value={state.disability.gcs.total} onChange={() => {}} className="md:col-start-2" />
                    <InputField label="Pupils" name="pupils" value={state.disability.pupils} onChange={e => handleNestedChange('disability', 'pupils', e)} className="md:col-span-2" />
                </Section>
                </>
            )}

            {state.presentationType === 'Medical/Trauma' && steps[currentStep - 1] === 'Vitals & Injuries' && (
                <>
                <VitalsChart vitals={state.vitals} />
                <Section title="Observations / Vital Signs">
                    <div className="md:col-span-4 space-y-4">
                    {state.vitals.map((vital, index) => (
                        <div key={index} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 items-end p-4 border rounded-md dark:border-gray-700">
                             <InputField type="time" label="Time" name="time" value={vital.time} onChange={(e) => handleVitalChange(index, e)}/>
                             <InputField label="HR" name="hr" value={vital.hr} onChange={(e) => handleVitalChange(index, e)}/>
                             <InputField label="RR" name="rr" value={vital.rr} onChange={(e) => handleVitalChange(index, e)}/>
                             <InputField label="BP" name="bp" value={vital.bp} onChange={(e) => handleVitalChange(index, e)}/>
                             <InputField label="SpO2 (%)" name="spo2" value={vital.spo2} onChange={(e) => handleVitalChange(index, e)}/>
                             <InputField label="Temp (°C)" name="temp" value={vital.temp} onChange={(e) => handleVitalChange(index, e)}/>
                             <InputField label="BG (mmol/L)" name="bg" value={vital.bg} onChange={(e) => handleVitalChange(index, e)}/>
                             <SelectField label="Pain" name="painScore" value={vital.painScore} onChange={(e) => handleVitalChange(index, e)}>
                                {Array.from({length: 11}, (_, i) => <option key={i} value={i}>{i}</option>)}
                             </SelectField>
                             <div className="flex items-center"><CheckboxField label="On O2?" name="onOxygen" checked={vital.onOxygen} onChange={(e) => handleVitalChange(index, e)}/></div>
                             <div className="flex items-center"><p className="text-sm dark:text-gray-300">NEWS2: <span className={`font-bold p-1 rounded ${getNews2RiskColor(vital.news2)} text-white`}>{vital.news2 ?? 'N/A'}</span></p></div>
                             <div className="flex justify-end"><button type="button" onClick={() => removeVitalSign(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button></div>
                        </div>
                    ))}
                    <button type="button" onClick={addVitalSign} className="flex items-center text-sm px-3 py-1 bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/>Add Vitals</button>
                    </div>
                </Section>
                <Section title="Secondary Survey & Injury Map">
                    <SpeechEnabledTextArea label="Secondary Survey Findings" name="secondarySurvey" value={state.secondarySurvey} onChange={handleChange} />
                    <div className="md:col-span-4"><InteractiveBodyMap value={state.injuries} onChange={handleInjuriesChange} /></div>
                </Section>
                </>
            )}

             {state.presentationType === 'Medical/Trauma' && steps[currentStep - 1] === 'Treatment' && (
                <Section title="Treatment & Interventions">
                    <TaggableInput label="Working Impressions" value={state.impressions} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'impressions', payload: v})} suggestions={commonImpressions} placeholder="e.g., Asthma, Fall" />
                    <TaggableInput label="Items Used" value={state.itemsUsed} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'itemsUsed', payload: v})} suggestions={commonItemsUsed} placeholder="e.g., Large Dressing" />
                    
                    <div className="md:col-span-4">
                        {/* FIX: Corrected variable name from labelClasses to labelBaseClasses. */}
                         <div className="flex justify-between items-center mb-2"><h3 className={labelBaseClasses}>Medications Administered</h3><button type="button" onClick={() => addDynamicListItem('medicationsAdministered')} className="flex items-center text-sm text-ams-blue dark:text-ams-light-blue"><PlusIcon className="w-4 h-4 mr-1"/>Add Medication</button></div>
                        {state.medicationsAdministered.map((med, index) => (
                             <div key={med.id} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end p-2 border-b dark:border-gray-700">
                                <InputField type="time" label="Time" name="time" value={med.time} onChange={(e) => handleDynamicListChange('medicationsAdministered', index, e)} />
                                <InputField label="Medication" name="medication" value={med.medication} list="drug-db" onChange={(e) => handleDynamicListChange('medicationsAdministered', index, e)} />
                                <InputField label="Dose" name="dose" value={med.dose} onChange={(e) => handleDynamicListChange('medicationsAdministered', index, e)} />
                                <SelectField label="Route" name="route" value={med.route} onChange={(e) => handleDynamicListChange('medicationsAdministered', index, e)}><option>PO</option><option>IV</option><option>IM</option><option>SC</option><option>SL</option><option>PR</option><option>Nebulised</option><option>Other</option></SelectField>
                                <button type="button" onClick={() => removeDynamicListItem('medicationsAdministered', index)} className="text-red-500 hover:text-red-700 h-10"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                     <div className="md:col-span-4">
                        {/* FIX: Corrected variable name from labelClasses to labelBaseClasses. */}
                         <div className="flex justify-between items-center mb-2"><h3 className={labelBaseClasses}>Interventions Performed</h3><button type="button" onClick={() => addDynamicListItem('interventions')} className="flex items-center text-sm text-ams-blue dark:text-ams-light-blue"><PlusIcon className="w-4 h-4 mr-1"/>Add Intervention</button></div>
                        {state.interventions.map((item, index) => (
                             <div key={item.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-2 border-b dark:border-gray-700">
                                <InputField type="time" label="Time" name="time" value={item.time} onChange={(e) => handleDynamicListChange('interventions', index, e)} className="sm:col-span-1" />
                                <InputField label="Intervention" name="intervention" value={item.intervention} onChange={(e) => handleDynamicListChange('interventions', index, e)} className="sm:col-span-2" />
                                <InputField label="Details" name="details" value={item.details} onChange={(e) => handleDynamicListChange('interventions', index, e)} className="sm:col-span-2" />
                                <button type="button" onClick={() => removeDynamicListItem('interventions', index)} className="text-red-500 hover:text-red-700 h-10"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* Minor Injury Step */}
            {state.presentationType === 'Minor Injury' && steps[currentStep - 1] === 'Injury Assessment' && (
                <Section title="Injury Assessment & Treatment">
                     <SpeechEnabledTextArea label="History of Injury" name="history" value={state.history} onChange={handleChange} rows={4} />
                     <TaggableInput label="Items Used" value={state.itemsUsed} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'itemsUsed', payload: v})} suggestions={commonItemsUsed} placeholder="e.g., Large Dressing" />
                     <SpeechEnabledTextArea label="Treatment Provided & Advice Given" name="handoverDetails" value={state.handoverDetails} onChange={handleChange} rows={4} />
                     <div className="md:col-span-4"><InteractiveBodyMap value={state.injuries} onChange={handleInjuriesChange} /></div>
                </Section>
            )}

            {/* Welfare Step */}
            {state.presentationType === 'Welfare/Intox' && steps[currentStep - 1] === 'Welfare Log' && (
                <Section title="Welfare Log">
                     <SpeechEnabledTextArea label="Presenting Situation" name="presentingComplaint" value={state.presentingComplaint} onChange={handleChange} rows={3} />
                     <div className="md:col-span-4">
                        {/* FIX: Corrected variable name from labelClasses to labelBaseClasses. */}
                         <div className="flex justify-between items-center mb-2"><h3 className={labelBaseClasses}>Log Entries</h3><button type="button" onClick={() => addDynamicListItem('welfareLog')} className="flex items-center text-sm text-ams-blue dark:text-ams-light-blue"><PlusIcon className="w-4 h-4 mr-1"/>Add Entry</button></div>
                        {state.welfareLog.map((item, index) => (
                             <div key={item.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-2 border-b dark:border-gray-700">
                                <InputField type="time" label="Time" name="time" value={item.time} onChange={(e) => handleDynamicListChange('welfareLog', index, e)} className="sm:col-span-1" />
                                <InputField label="Observation / Action" name="observation" value={item.observation} onChange={(e) => handleDynamicListChange('welfareLog', index, e)} className="sm:col-span-4" />
                                <button type="button" onClick={() => removeDynamicListItem('welfareLog', index)} className="text-red-500 hover:text-red-700 h-10"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {steps[currentStep - 1] === 'Disposition & Signatures' && (
                <>
                <Section title="Disposition & Handover">
                    <SelectField label="Final Patient Disposition" name="disposition" value={state.disposition} onChange={handleChange} className="md:col-span-2">
                        <option value="Not Set">-- Select --</option>
                        <option>Conveyed to ED</option>
                        <option>Left at Home (Own Consent)</option>
                        <option>Left at Home (Against Advice)</option>
                        <option>Referred to Other Service</option>
                        <option>Deceased on Scene</option>
                    </SelectField>
                    {state.disposition === 'Conveyed to ED' && <>
                        <InputField label="Destination" name="destination" value={state.dispositionDetails.destination} onChange={(e) => handleNestedChange('dispositionDetails', 'destination', e)} />
                        <InputField label="Receiving Clinician" name="receivingClinician" value={state.dispositionDetails.receivingClinician} onChange={(e) => handleNestedChange('dispositionDetails', 'receivingClinician', e)} />
                    </>}
                    {state.disposition === 'Referred to Other Service' && <InputField label="Referral Details" name="referralDetails" value={state.dispositionDetails.referralDetails} onChange={(e) => handleNestedChange('dispositionDetails', 'referralDetails', e)} className="md:col-span-2" />}
                    <div className="md:col-span-4 relative">
                        <SpeechEnabledTextArea label="Handover Details (SBAR)" name="handoverDetails" value={state.handoverDetails} onChange={handleChange} rows={5} />
                        <button type="button" onClick={handleGenerateSummary} disabled={isSummarizing} className="absolute top-0 right-0 flex items-center text-sm px-3 py-1 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 disabled:bg-gray-200">
                           {isSummarizing ? <SpinnerIcon className="w-4 h-4 mr-2"/> : <SparklesIcon className="w-4 h-4 mr-2"/>} Generate Summary
                        </button>
                    </div>
                </Section>
                <Section title="Crew & Signatures">
                    <div className="md:col-span-2">
                        <label className={labelBaseClasses}>Attending Crew</label>
                        <ul className="mt-1 space-y-1">
                            {state.crewMembers.map(c => <li key={c.uid} className="flex justify-between items-center p-1 bg-gray-100 dark:bg-gray-700 rounded-md">{c.name} {c.uid !== user?.uid && <button onClick={() => handleRemoveCrewMember(c.uid)} className="text-red-500 text-xs">remove</button>}</li>)}
                        </ul>
                        <div className="flex gap-2 mt-2">
                            <select value={selectedCrewMember} onChange={e => setSelectedCrewMember(e.target.value)} className={`${inputBaseClasses} flex-grow`}><option value="">Add crew member...</option>{allStaff.filter(s => !state.crewMembers.some(c => c.uid === s.uid)).map(s => <option key={s.uid} value={s.uid}>{s.firstName} {s.lastName}</option>)}</select>
                            <button type="button" onClick={handleAddCrewMember} className="px-3 bg-ams-blue text-white rounded-md text-sm">Add</button>
                        </div>
                    </div>
                    <div className="md:col-span-1">
                        <label className={labelBaseClasses}>Clinician Signature</label>
                        <SignaturePad ref={clinicianSigRef} />
                    </div>
                     <div className="md:col-span-1">
                        <label className={labelBaseClasses}>Patient / Guardian Signature</label>
                        <SignaturePad ref={patientSigRef} />
                    </div>
                </Section>
                </>
            )}

            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 flex justify-between items-center shadow-lg md:pl-64 z-10">
                <div className="flex gap-2 items-center">
                    <button type="button" onClick={() => setIsDeleteModalOpen(true)} disabled={isDeleting} className="p-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full hover:bg-red-200">
                        {isDeleting ? <SpinnerIcon className="w-5 h-5" /> : <TrashIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setCurrentStep(s => s > 1 ? s - 1 : 1)} disabled={currentStep === 1} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50 flex items-center"><ChevronLeftIcon className="w-5 h-5 mr-1"/> Prev</button>
                    <button onClick={() => setCurrentStep(s => s < steps.length ? s + 1 : s)} disabled={currentStep === steps.length} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50 flex items-center">Next <ChevronRightIcon className="w-5 h-5 ml-1"/></button>
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