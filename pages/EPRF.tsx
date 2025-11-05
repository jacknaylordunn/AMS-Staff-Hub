import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import type { EPRFForm, Patient, VitalSign, MedicationAdministered, Intervention, Injury, WelfareLogEntry, User as AppUser, Attachment, EventLog } from '../types';
import { PlusIcon, TrashIcon, SpinnerIcon, CheckIcon, CameraIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, EventsIcon, SparklesIcon, QuestionMarkCircleIcon, ShieldExclamationIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { searchPatients, addPatient } from '../services/patientService';
import { getActiveDraftEPRF, createDraftEPRF, updateEPRF, finalizeEPRF, deleteEPRF } from '../services/eprfService';
import { getEvents } from '../services/eventService';
import { getUsers } from '../services/userService';
import { uploadFile } from '../services/storageService';
import { showToast } from '../components/Toast';
import PatientModal from '../components/PatientModal';
import { calculateNews2Score, getNews2RiskColor } from '../utils/news2Calculator';
import InteractiveBodyMap from '../components/InteractiveBodyMap';
import ConfirmationModal from '../components/ConfirmationModal';
import SpeechEnabledTextArea from '../components/SpeechEnabledTextArea';
import ValidationModal from '../components/ValidationModal';
import TaggableInput from '../components/TaggableInput';
import { DRUG_DATABASE } from '../utils/drugDatabase';
import SignaturePad, { SignaturePadRef } from '../components/SignaturePad';
import VitalsChart from '../components/VitalsChart';
import QuickAddModal from '../components/QuickAddModal';
import GuidelineAssistantModal from '../components/GuidelineAssistantModal';

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
    case 'UPDATE_DYNAMIC_LIST':
        return { ...state, [action.listName]: action.payload };
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


const EventSelector: React.FC<{ onEventSelect: (event: EventLog) => void }> = ({ onEventSelect }) => {
    const [events, setEvents] = useState<EventLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActiveEvents = async () => {
            setLoading(true);
            try {
                const allEvents = await getEvents();
                // Show events that are 'Active' or 'Upcoming'
                setEvents(allEvents.filter(e => e.status !== 'Completed'));
            } catch (error) {
                showToast("Could not fetch events.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchActiveEvents();
    }, []);

    return (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-white dark:bg-gray-800 rounded-lg shadow h-full">
            <EventsIcon className="w-20 h-20 text-ams-blue dark:text-ams-light-blue mb-4" />
            <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-4">Select Event for this Report</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">Please select the event this patient report is for. If you are on duty, your active event should be highlighted.</p>
            {loading ? (
                <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
            ) : (
                <div className="w-full max-w-lg space-y-3">
                    {events.length > 0 ? events.map(event => (
                        <button
                            key={event.id}
                            onClick={() => onEventSelect(event)}
                            className="w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-ams-light-blue hover:text-white dark:hover:bg-ams-light-blue transition-colors shadow"
                        >
                            <p className="font-bold text-lg">{event.name}</p>
                            <p className="text-sm">{event.location} - {event.date}</p>
                        </button>
                    )) : <p>No active or upcoming events found.</p>}
                </div>
            )}
        </div>
    );
};


const EPRF: React.FC = () => {
    const { user } = useAuth();
    const { activeEvent: contextEvent } = useAppContext();
    const { isOnline } = useOnlineStatus();
    const navigate = useNavigate();
    
    const clinicianSigRef = useRef<SignaturePadRef>(null);
    const patientSigRef = useRef<SignaturePadRef>(null);

    const [eventForEPRF, setEventForEPRF] = useState<EventLog | null>(contextEvent);
    
    const getInitialFormState = useCallback((event: EventLog | null, user: AppUser | null): EPRFForm => {
      const now = new Date();
      const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
      const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
      return {
        patientId: null,
        eventId: event?.id || null,
        eventName: event?.name || null,
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
        incidentLocation: event?.location || '',
        patientName: '',
        patientAge: '',
        patientGender: 'Unknown',
        presentingComplaint: '',
        history: '',
        mechanismOfInjury: '',
        allergies: [],
        medications: [],
        pastMedicalHistory: '',
        lastOralIntake: '',
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
        itemsUsed: [],
        disposal: '',
        disposition: 'Not Set',
        dispositionDetails: { destination: '', receivingClinician: '', referralDetails: '' },
        handoverDetails: '',
        refusalOfCare: { refusedTreatment: false, refusedTransport: false, risksExplained: false, capacityDemonstrated: false, details: '' },
        safeguarding: { concerns: [], details: '' },
        mentalCapacity: { assessment: [], outcome: 'Not Assessed', details: '' },
        welfareLog: [],
        attachments: [],
        patientSignatureUrl: '',
        clinicianSignatureUrl: '',
        crewMembers: user ? [{ uid: user.uid, name: fullName }] : [],
        createdAt: Timestamp.now(),
        createdBy: user ? { uid: user.uid, name: fullName } : { uid: '', name: '' },
        status: 'Draft',
        auditLog: [],
      }
    }, []);

    const [state, dispatch] = useReducer(eprfReducer, getInitialFormState(eventForEPRF, user));
    
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
    const [isFormLoading, setIsFormLoading] = useState(true);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [allStaff, setAllStaff] = useState<AppUser[]>([]);
    const [selectedCrewMember, setSelectedCrewMember] = useState<string>('');
    const [currentStep, setCurrentStep] = useState(1);
    const [showSafeguardingPrompt, setShowSafeguardingPrompt] = useState(false);
    const [safeguardingCheckText, setSafeguardingCheckText] = useState('');

    const steps = ['Incident', 'Patient', 'Assessment', 'Vitals & Injuries', 'Treatment', 'Disposition & Signatures'];

    useEffect(() => {
        getUsers().then(setAllStaff);
    }, []);

    // Load or create draft ePRF once an event is selected
    const loadOrCreateDraft = useCallback(async (event: EventLog) => {
        if (!user) return;
        
        setIsFormLoading(true);
        setLoadingError(null);
        try {
            let draft = await getActiveDraftEPRF(user.uid, event.id);
            if (!draft) {
                draft = await createDraftEPRF(getInitialFormState(event, user));
            }
            dispatch({ type: 'LOAD_DRAFT', payload: draft });
        } catch (error: any) {
            console.error("Error loading/creating draft:", error);
            setLoadingError("An unexpected error occurred while loading your draft. Please check your connection and try again.");
            showToast("Could not load ePRF draft.", "error");
        } finally {
            setIsFormLoading(false);
        }
    }, [user, getInitialFormState]);

    useEffect(() => {
        if (eventForEPRF) {
            loadOrCreateDraft(eventForEPRF);
        } else {
            setIsFormLoading(false); // No event, so not loading a form
        }
    }, [eventForEPRF, loadOrCreateDraft]);

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

    const handleSetTimeToNow = (fieldName: keyof EPRFForm) => () => {
        const timeString = new Date().toTimeString().split(' ')[0].substring(0, 5);
        dispatch({ type: 'UPDATE_FIELD', field: fieldName, payload: timeString });
    };

    const handleSetTimeToNowNested = (field: string, subField: string) => () => {
        const timeString = new Date().toTimeString().split(' ')[0].substring(0, 5);
        dispatch({ type: 'UPDATE_NESTED_FIELD', field, subField, payload: timeString });
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

    const resizeImage = (file: File, maxWidth = 800, maxHeight = 800): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                if (!event.target?.result) {
                    return reject(new Error("Could not read file."));
                }
                const img = new Image();
                img.src = event.target.result as string;
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
                    if (!ctx) {
                        return reject(new Error("Could not get canvas context."));
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(
                      (blob) => {
                        if (blob) {
                          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                        } else {
                          reject(new Error('Canvas to Blob conversion failed'));
                        }
                      },
                      'image/jpeg',
                      0.7
                    );
                };
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isOnline) {
            showToast('Attachments can only be added when online.', 'error');
            return;
        }
        if (e.target.files && e.target.files[0] && state.id) {
            const file = e.target.files[0];
            try {
                const resizedFile = await resizeImage(file);
                const filePath = `attachments/${state.id}/${Date.now()}_${resizedFile.name}`;
                const downloadURL = await uploadFile(resizedFile, filePath);
                const newAttachment: Attachment = {
                    id: Date.now().toString(),
                    url: downloadURL,
                    fileName: resizedFile.name,
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
        // Note: This only removes from Firestore doc. For a full implementation, you'd also delete from Firebase Storage.
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
    
    const handleGenerateSummary = async () => {
        setIsSummarizing(true);
        try {
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
             const prompt = `
              Generate a concise, professional clinical handover summary in SBAR format (Situation, Background, Assessment, Recommendation) based on the following ePRF data. The output must be plain text and only use the information provided.

              **PATIENT DATA:**
              - Name: ${state.patientName}
              - Age: ${state.patientAge}
              - Gender: ${state.patientGender}

              **SITUATION:**
              - Presenting Complaint: ${state.presentingComplaint}

              **BACKGROUND:**
              - History of Complaint: ${state.history}
              - Allergies: ${state.allergies.join(', ') || 'None known'}
              - Current Medications: ${state.medications.join(', ') || 'None'}
              - Past Medical History: ${state.pastMedicalHistory || 'None'}

              **ASSESSMENT:**
              - Primary Survey (ABCDE): Airway: ${state.airway}, Breathing: ${state.breathing}, Circulation: ${state.circulation}, Disability: AVPU ${state.disability.avpu} GCS ${state.disability.gcs.total}, Exposure: ${state.exposure}
              - Vital Signs Summary:
                ${state.vitals.map(v => `  - Time: ${v.time}, HR: ${v.hr}, RR: ${v.rr}, BP: ${v.bp}, SpO2: ${v.spo2}%, Temp: ${v.temp}°C, NEWS2: ${v.news2 ?? 'N/A'}`).join('\n')}
              - Injuries: ${state.injuries.map(i => `${i.description} (${i.view} view)`).join('; ') || 'None'}
              - Working Impressions: ${state.impressions.join(', ') || 'Not specified'}

              **RECOMMENDATION / TREATMENT:**
              - Medications Administered:
                ${state.medicationsAdministered.map(m => `  - ${m.time}: ${m.medication} ${m.dose} ${m.route}`).join('\n') || '  - None'}
              - Interventions Performed:
                ${state.interventions.map(i => `  - ${i.time}: ${i.intervention} - ${i.details}`).join('\n') || '  - None'}
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            const summary = response.text;
            const disclaimer = "*** AI-Generated Summary (Clinician must review for accuracy before use) ***\n\n";
            dispatch({ type: 'UPDATE_FIELD', field: 'handoverDetails', payload: disclaimer + summary });
            showToast("Handover summary generated.", "success");

        } catch (error) {
            console.error("Gemini summary failed:", error);
            showToast("Could not generate summary.", "error");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleSafeguardingCheck = async (text: string) => {
        if (!text || text.length < 50 || text === safeguardingCheckText || !isOnline) {
            return;
        }
        setSafeguardingCheckText(text);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const systemInstruction = "You are an AI assistant trained to identify potential safeguarding concerns in clinical text based on UK safeguarding principles. Your task is to analyze the following text and determine if it contains any indicators of child abuse, adult abuse, domestic violence, neglect, or vulnerability (e.g., inconsistent injury history, concerning quotes, mentions of self-harm). Respond with ONLY the word 'true' if potential indicators are present, and ONLY the word 'false' otherwise. Do not provide any explanation or other text.";
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: text,
                config: { systemInstruction },
            });
            
            if (response.text.trim().toLowerCase() === 'true') {
                setShowSafeguardingPrompt(true);
            }

        } catch (err) {
            console.error("Safeguarding check failed:", err);
            // Fail silently
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
        
        if (!clinicianSigRef.current?.getSignature()) {
            errors.push("The lead clinician must sign the report before finalization.");
        }

        if (errors.length > 0) {
            setValidationErrors(errors);
            setValidationModalOpen(true);
            return;
        }

        setIsSaving(true);
        let updatedState: EPRFForm = { ...state, signaturesNeedSync: !isOnline };

        try {
            const clinicianSignatureDataUrl = clinicianSigRef.current?.getSignature();
            if (clinicianSignatureDataUrl) {
                if (isOnline) {
                    const blob = dataURLtoBlob(clinicianSignatureDataUrl);
                    const filePath = `signatures/${state.id}/clinician_${Date.now()}.png`;
                    const downloadURL = await uploadFile(blob, filePath);
                    updatedState.clinicianSignatureUrl = downloadURL;
                } else {
                    updatedState.clinicianSignatureUrl = clinicianSignatureDataUrl;
                }
            }

            const patientSignatureDataUrl = patientSigRef.current?.getSignature();
            if (patientSignatureDataUrl) {
                if (isOnline) {
                    const blob = dataURLtoBlob(patientSignatureDataUrl);
                    const filePath = `signatures/${state.id}/patient_${Date.now()}.png`;
                    const downloadURL = await uploadFile(blob, filePath);
                    updatedState.patientSignatureUrl = downloadURL;
                } else {
                    updatedState.patientSignatureUrl = patientSignatureDataUrl;
                }
            }
            
            if (!isOnline) {
                showToast('Offline: Signature saved locally, will sync when online.', 'info');
            }

            await finalizeEPRF(state.id, updatedState);
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
            // Instead of creating new draft, go back to event selection
            setEventForEPRF(null);
            // reset state to initial
            dispatch({ type: 'LOAD_DRAFT', payload: getInitialFormState(null, user) });
        } catch (error) {
            console.error("Delete failed:", error);
            showToast("Could not delete draft.", "error");
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    const TimeInputField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onSetTimeToNow: () => void; className?: string; }> = ({ label, name, value, onChange, onSetTimeToNow, className }) => (
        <FieldWrapper className={className}>
            <label htmlFor={name} className={labelBaseClasses}>{label}</label>
            <div className="relative flex items-center">
                <input type="time" id={name} name={name} value={value} onChange={onChange} className={`${inputBaseClasses} w-full`} />
                <button type="button" onClick={onSetTimeToNow} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-ams-light-blue" title="Set to now">
                    <ClockIcon className="w-5 h-5"/>
                </button>
            </div>
        </FieldWrapper>
    );

    if (isFormLoading) {
        return <div className="flex items-center justify-center h-96"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /><span className="ml-4 text-lg dark:text-gray-300">Loading Patient Report Form...</span></div>;
    }

    if (!eventForEPRF) {
        return <EventSelector onEventSelect={setEventForEPRF} />;
    }

    if (loadingError) {
        return (
            <div className="text-center p-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Form</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{loadingError}</p>
                <button onClick={() => {if(eventForEPRF) loadOrCreateDraft(eventForEPRF)}} className="px-6 py-3 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90">
                    Retry
                </button>
            </div>
        );
    }
    
    return (
        <div className="pb-24">
            <SaveStatusIndicator status={saveStatus} />
            <PatientModal isOpen={isPatientModalOpen} onClose={() => setPatientModalOpen(false)} onSave={handleSaveNewPatient} />
            <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setQuickAddOpen(false)} onSave={handleQuickAdd} />
            <GuidelineAssistantModal isOpen={isGuidelineModalOpen} onClose={() => setGuidelineModalOpen(false)} />
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Delete Draft ePRF" message="Are you sure you want to permanently delete this draft? This action cannot be undone." confirmText="Delete" isLoading={isDeleting}/>
            <ValidationModal isOpen={isValidationModalOpen} onClose={() => setValidationModalOpen(false)} errors={validationErrors} />
            
            <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-4">
                <button
                    type="button"
                    onClick={() => setGuidelineModalOpen(true)}
                    className="bg-ams-blue text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-opacity-90 transition-transform hover:scale-110"
                    title="Clinical Guideline Assistant"
                    aria-label="Open Clinical Guideline Assistant"
                >
                    <QuestionMarkCircleIcon className="w-8 h-8" />
                </button>
                <button
                    type="button"
                    onClick={() => setQuickAddOpen(true)}
                    className="bg-ams-light-blue text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-opacity-90 transition-transform hover:scale-110"
                    title="Quick Add"
                    aria-label="Quick Add Menu"
                >
                    <PlusIcon className="w-8 h-8" />
                </button>
            </div>
            
            {/* Stepper Navigation */}
            <div className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md sticky top-20 z-20">
                <ol className="flex items-center w-full">
                    {steps.map((step, index) => {
                        const stepNumber = index + 1;
                        const isCompleted = stepNumber < currentStep;
                        const isActive = stepNumber === currentStep;
                        return (
                            <li key={step} className={`flex w-full items-center ${stepNumber < steps.length ? "after:content-[''] after:w-full after:h-1 after:border-b-4 after:inline-block " + (isCompleted ? 'after:border-ams-blue dark:after:border-ams-light-blue' : 'after:border-gray-200 dark:after:border-gray-700') : ''}`}>
                                <button onClick={() => setCurrentStep(stepNumber)} className="flex flex-col items-center justify-center w-auto shrink-0" disabled={!isCompleted && !isActive}>
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isActive ? 'bg-ams-light-blue' : isCompleted ? 'bg-ams-blue' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                        {isCompleted ? <CheckIcon className="w-6 h-6 text-white"/> : <span className={`font-bold text-lg ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>{stepNumber}</span>}
                                    </div>
                                    <span className={`hidden sm:block text-xs mt-2 ${isActive ? 'font-bold text-ams-blue dark:text-ams-light-blue' : 'text-gray-500 dark:text-gray-400'}`}>{step}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {showSafeguardingPrompt && (
                <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md dark:bg-yellow-900 dark:text-yellow-200 flex justify-between items-center">
                    <div className="flex items-center">
                        <ShieldExclamationIcon className="w-6 h-6 mr-3" />
                        <div>
                            <p className="font-bold">Potential Safeguarding Indicator</p>
                            <p className="text-sm">The text may contain details that warrant a safeguarding review. Please document accordingly.</p>
                        </div>
                    </div>
                    <button onClick={() => setShowSafeguardingPrompt(false)} className="font-bold text-2xl">&times;</button>
                </div>
            )}

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
                {/* Step 1: Incident */}
                <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
                    <Section title="Incident & Timestamps">
                        <SelectField label="Presentation Type" name="presentationType" value={state.presentationType} onChange={handleChange} className="lg:col-span-2">
                            <option>Medical/Trauma</option>
                            <option>Minor Injury</option>
                            <option>Welfare/Intox</option>
                        </SelectField>
                        <InputField label="Incident #" name="incidentNumber" value={state.incidentNumber} onChange={handleChange} />
                        <InputField label="Incident Date" name="incidentDate" type="date" value={state.incidentDate} onChange={handleChange} />
                        <TimeInputField label="Incident Time" name="incidentTime" value={state.incidentTime} onChange={handleChange} onSetTimeToNow={handleSetTimeToNow('incidentTime')} />
                        <InputField label="Location" name="incidentLocation" value={state.incidentLocation} onChange={handleChange} className="md:col-span-2 lg:col-span-3"/>
                        <TimeInputField label="Time of Call" name="timeOfCall" value={state.timeOfCall || ''} onChange={handleChange} onSetTimeToNow={handleSetTimeToNow('timeOfCall')} />
                        <TimeInputField label="On Scene Time" name="onSceneTime" value={state.onSceneTime || ''} onChange={handleChange} onSetTimeToNow={handleSetTimeToNow('onSceneTime')} />
                        <TimeInputField label="At Patient Time" name="atPatientTime" value={state.atPatientTime || ''} onChange={handleChange} onSetTimeToNow={handleSetTimeToNow('atPatientTime')} />
                        <TimeInputField label="Left Scene Time" name="leftSceneTime" value={state.leftSceneTime || ''} onChange={handleChange} onSetTimeToNow={handleSetTimeToNow('leftSceneTime')} />
                        <TimeInputField label="At Destination Time" name="atDestinationTime" value={state.atDestinationTime || ''} onChange={handleChange} onSetTimeToNow={handleSetTimeToNow('atDestinationTime')} />
                        <TimeInputField label="Clear Time" name="clearDestinationTime" value={state.clearDestinationTime || ''} onChange={handleChange} onSetTimeToNow={handleSetTimeToNow('clearDestinationTime')} />
                    </Section>
                </div>

                {/* Step 2: Patient */}
                 <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
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

                        {state.patientId && (
                            <div className="md:col-span-2 lg:col-span-4 flex items-center gap-4 p-3 bg-green-50 dark:bg-green-900/50 rounded-md border border-green-200 dark:border-green-800">
                                <p className="font-semibold text-green-800 dark:text-green-200">Selected Patient: {state.patientName}</p>
                                <button type="button" onClick={() => dispatch({ type: 'CLEAR_PATIENT' })} className="text-sm font-bold text-red-600 hover:underline">Clear</button>
                            </div>
                        )}

                        <InputField label="Patient Name" name="patientName" value={state.patientName} onChange={handleChange} required/>
                        <InputField label="Patient Age" name="patientAge" value={state.patientAge} onChange={handleChange} required/>
                        <SelectField label="Patient Gender" name="patientGender" value={state.patientGender} onChange={handleChange}>
                            <option>Unknown</option><option>Male</option><option>Female</option><option>Other</option>
                        </SelectField>
                    </Section>
                 </div>
                
                 {/* Step 3: Assessment */}
                 <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
                    <Section title="Clinical Assessment (SAMPLE)">
                        <SpeechEnabledTextArea label="Presenting Complaint / Situation" name="presentingComplaint" value={state.presentingComplaint} onChange={handleChange} onBlur={e => handleSafeguardingCheck(e.target.value)} />
                        <SpeechEnabledTextArea label="History of Complaint / Events" name="history" value={state.history} onChange={handleChange} onBlur={e => handleSafeguardingCheck(e.target.value)} />
                        <SpeechEnabledTextArea label="Mechanism of Injury" name="mechanismOfInjury" value={state.mechanismOfInjury ?? ''} onChange={handleChange} />
                        <TaggableInput label="Allergies" value={state.allergies} onChange={(v) => dispatch({ type: 'UPDATE_FIELD', field: 'allergies', payload: v })} suggestions={DRUG_DATABASE} placeholder="Type to search for drug allergies..."/>
                        <TaggableInput label="Current Medications" value={state.medications} onChange={(v) => dispatch({ type: 'UPDATE_FIELD', field: 'medications', payload: v })} suggestions={DRUG_DATABASE} placeholder="Type to search for medications..."/>
                        <TextAreaField label="Past Medical History" name="pastMedicalHistory" value={state.pastMedicalHistory} onChange={handleChange} rows={2}/>
                        <TextAreaField label="Last Meal / Oral Intake" name="lastOralIntake" value={state.lastOralIntake} onChange={handleChange} rows={2}/>
                    </Section>
                    {state.presentationType === 'Medical/Trauma' &&
                    <Section title="Pain Assessment (OPQRST)">
                        <InputField label="Onset" name="onset" value={state.painAssessment.onset} onChange={e => handleNestedChange('painAssessment', 'onset', e)} />
                        <InputField label="Provocation" name="provocation" value={state.painAssessment.provocation} onChange={e => handleNestedChange('painAssessment', 'provocation', e)} />
                        <InputField label="Quality" name="quality" value={state.painAssessment.quality} onChange={e => handleNestedChange('painAssessment', 'quality', e)} />
                        <InputField label="Radiation" name="radiation" value={state.painAssessment.radiation} onChange={e => handleNestedChange('painAssessment', 'radiation', e)} />
                        <TimeInputField label="Time" name="time" value={state.painAssessment.time} onChange={e => handleNestedChange('painAssessment', 'time', e)} onSetTimeToNow={handleSetTimeToNowNested('painAssessment', 'time')} />
                            <SelectField label="Severity" name="severity" value={state.painAssessment.severity} onChange={e => handleNestedChange('painAssessment', 'severity', e)}>
                            {Array.from({length: 11}, (_, i) => <option key={i} value={i}>{i}</option>)}
                        </SelectField>
                    </Section>
                    }
                 </div>
                 
                 {/* Step 4: Vitals & Injuries */}
                 <div style={{ display: currentStep === 4 ? 'block' : 'none' }}>
                    {state.presentationType === 'Welfare/Intox' && (
                        <Section title="Welfare Log">
                            <FieldWrapper className="md:col-span-2 lg:col-span-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className={labelBaseClasses}>Log Entries</h3>
                                    <button type="button" onClick={() => addDynamicListItem('welfareLog')} className="flex items-center px-3 py-1.5 text-sm bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/>Add Entry</button>
                                </div>
                                <div className="space-y-2">
                                {state.welfareLog.map((item, index) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                        <input type="time" name="time" value={item.time} onChange={e => handleDynamicListChange('welfareLog', index, e)} className={`${inputBaseClasses} col-span-3`} />
                                        <input type="text" name="observation" placeholder="Observation / Action" value={item.observation} onChange={e => handleDynamicListChange('welfareLog', index, e)} className={`${inputBaseClasses} col-span-8`} />
                                        <button type="button" onClick={() => removeDynamicListItem('welfareLog', index)} aria-label="Remove welfare log entry" className="text-red-500 hover:text-red-700 col-span-1 justify-self-end"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                ))}
                                </div>
                            </FieldWrapper>
                        </Section>
                    )}
                    {state.presentationType !== 'Welfare/Intox' &&
                    <>
                        <Section title="Primary Survey (ABCDE) & Disability">
                            <SpeechEnabledTextArea label="Airway" name="airway" value={state.airway} onChange={handleChange} rows={2} />
                            <SpeechEnabledTextArea label="Breathing" name="breathing" value={state.breathing} onChange={handleChange} rows={2} />
                            <SpeechEnabledTextArea label="Circulation" name="circulation" value={state.circulation} onChange={handleChange} rows={2} />
                            <SpeechEnabledTextArea label="Exposure" name="exposure" value={state.exposure} onChange={handleChange} rows={2} />
                            <SelectField label="AVPU" name="avpu" value={state.disability.avpu} onChange={e => handleNestedChange('disability', 'avpu', e)}><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></SelectField>
                            <SelectField label="GCS Eyes" name="eyes" value={state.disability.gcs.eyes} onChange={handleGCSChange}><option value="4">4 - Spontaneous</option><option value="3">3 - To speech</option><option value="2">2 - To pain</option><option value="1">1 - None</option></SelectField>
                            <SelectField label="GCS Verbal" name="verbal" value={state.disability.gcs.verbal} onChange={handleGCSChange}><option value="5">5 - Orientated</option><option value="4">4 - Confused</option><option value="3">3 - Inappropriate words</option><option value="2">2 - Incomprehensible</option><option value="1">1 - None</option></SelectField>
                            <SelectField label="GCS Motor" name="motor" value={state.disability.gcs.motor} onChange={handleGCSChange}><option value="6">6 - Obeys commands</option><option value="5">5 - Localises pain</option><option value="4">4 - Withdraws from pain</option><option value="3">3 - Flexion to pain</option><option value="2">2 - Extension to pain</option><option value="1">1 - None</option></SelectField>
                            <div className="flex items-center justify-center p-4 bg-ams-blue dark:bg-ams-light-blue text-white dark:text-ams-blue rounded-lg font-bold text-xl lg:col-span-4 text-center">GCS Total: {state.disability.gcs.total}</div>
                            <TextAreaField label="Pupils" name="pupils" value={state.disability.pupils} onChange={e => handleNestedChange('disability', 'pupils', e)} rows={1} />
                        </Section>
                        <VitalsChart vitals={state.vitals} />
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">Observations</h2>
                                <button type="button" onClick={addVitalSign} className="flex items-center px-3 py-1.5 text-sm bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/>Add Vitals</button>
                            </div>
                            <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700">{['Time', 'HR', 'RR', 'BP', 'SpO2', 'Temp', 'BG', 'Pain', 'O2', 'NEWS2', ''].map(h => <th key={h} className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>)}</tr>
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
                            <SpeechEnabledTextArea label="Further Assessment Findings" name="secondarySurvey" value={state.secondarySurvey} onChange={handleChange} onBlur={e => handleSafeguardingCheck(e.target.value)} />
                            <FieldWrapper className="md:col-span-2 lg:col-span-4">
                                <InteractiveBodyMap value={state.injuries} onChange={handleInjuriesChange} />
                            </FieldWrapper>
                        </Section>
                    </>
                    }
                 </div>
                
                 {/* Step 5: Treatment */}
                <div style={{ display: currentStep === 5 ? 'block' : 'none' }}>
                    <Section title="Treatment">
                        <TaggableInput
                            label="Working Impressions"
                            value={state.impressions}
                            onChange={(v) => dispatch({ type: 'UPDATE_FIELD', field: 'impressions', payload: v })}
                            suggestions={commonImpressions}
                            placeholder="e.g., Asthma, Fall..."
                        />
                         <TaggableInput
                            label="Kit Items Used"
                            value={state.itemsUsed}
                            onChange={(v) => dispatch({ type: 'UPDATE_FIELD', field: 'itemsUsed', payload: v })}
                            suggestions={commonItemsUsed}
                            placeholder="e.g., Large Dressing..."
                        />
                        <FieldWrapper className="md:col-span-2 lg:col-span-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className={labelBaseClasses}>Medications Administered</h3>
                                <button type="button" onClick={() => addDynamicListItem('medicationsAdministered')} className="flex items-center px-3 py-1.5 text-sm bg-ams-blue text-white rounded-md hover:bg-opacity-90"><PlusIcon className="w-4 h-4 mr-1"/>Add Med</button>
                            </div>
                            <datalist id="drug-db-list">
                                {DRUG_DATABASE.map(med => <option key={med} value={med} />)}
                            </datalist>
                            <div className="space-y-2">
                            {state.medicationsAdministered.map((med, index) => {
                                const isRestricted = RESTRICTED_MEDICATIONS.includes(med.medication);
                                const canAuthorise = user && SENIOR_CLINICIAN_ROLES.includes(user.role) && state.crewMembers.some(cm => cm.uid === user.uid);
                                return (
                                <div key={med.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                    <input type="time" name="time" value={med.time} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} col-span-4 md:col-span-2`} />
                                    <input type="text" name="medication" placeholder="Medication" value={med.medication} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={`${inputBaseClasses} col-span-8 md:col-span-3`} list="drug-db-list" />
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
                    </Section>
                </div>
                
                 {/* Step 6: Disposition & Signatures */}
                <div style={{ display: currentStep === 6 ? 'block' : 'none' }}>
                    <Section title="Disposition & Handover">
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

                        <FieldWrapper className="md:col-span-2 lg:col-span-4">
                            <div className="flex items-center gap-4 mb-1">
                                <label htmlFor="handoverDetails" className={labelBaseClasses}>Handover Details</label>
                                {isOnline && (
                                    <button 
                                        type="button" 
                                        onClick={handleGenerateSummary} 
                                        disabled={isSummarizing}
                                        className="flex items-center gap-1 text-sm text-ams-blue dark:text-ams-light-blue font-semibold hover:opacity-80 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isSummarizing ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                        {isSummarizing ? 'Generating...' : 'Generate Summary'}
                                    </button>
                                )}
                            </div>
                            <SpeechEnabledTextArea label="" name="handoverDetails" value={state.handoverDetails} onChange={handleChange} className="" />
                        </FieldWrapper>
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
                             <FieldWrapper className="md:col-span-2 lg:col-span-4">
                                <label className={labelBaseClasses}>Patient/Guardian Signature</label>
                                <p className="text-xs text-gray-500 mb-2">Signature confirms the patient/guardian understands the risks of refusing treatment/transport.</p>
                                <SignaturePad ref={patientSigRef} />
                            </FieldWrapper>
                        </Section>
                    }

                    <Section title="Attachments">
                        <FieldWrapper className="md:col-span-2 lg:col-span-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {state.attachments.map((att) => (
                                    <div key={att.id} className="relative group border rounded-lg p-2 dark:border-gray-700">
                                        <img src={att.url} alt={att.fileName} className="rounded-md w-full h-32 object-cover" />
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
                                <label title={!isOnline ? "Attachments can only be added when online" : "Add Photo"} className={`flex flex-col items-center justify-center w-full h-full min-h-[160px] p-4 border-2 border-dashed rounded-lg ${isOnline ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : 'cursor-not-allowed bg-gray-100 dark:bg-gray-800 opacity-50'} dark:border-gray-600 `}>
                                    <CameraIcon className="w-10 h-10 text-gray-400" />
                                    <span className="mt-2 text-sm text-center text-gray-500 dark:text-gray-400">Add Photo</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddAttachment} disabled={!isOnline} />
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
                    
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">Clinician Signature</h2>
                        <FieldWrapper className="md:col-span-2 lg:col-span-4">
                            <label className={labelBaseClasses}>Lead Clinician Signature</label>
                            <p className="text-xs text-gray-500 mb-2">I confirm that this is a true and accurate record of the patient encounter.</p>
                            <SignaturePad ref={clinicianSigRef} />
                        </FieldWrapper>
                    </div>
                </div>
            </form>

            {/* Sticky Footer for Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 shadow-lg md:pl-72 z-30">
                <div className="flex justify-between items-center max-w-screen-xl mx-auto">
                    <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700">
                        Delete Draft
                    </button>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 1} className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full disabled:opacity-50">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        {currentStep < steps.length ? (
                            <button onClick={() => setCurrentStep(s => s + 1)} className="px-6 py-3 bg-ams-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 flex items-center gap-2">
                                Next <ChevronRightIcon className="w-5 h-5"/>
                            </button>
                        ) : (
                            <button type="button" onClick={handleFinalize} disabled={isSaving} className="px-8 py-4 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                                {isSaving && <SpinnerIcon className="w-6 h-6 mr-3" />}
                                {isSaving ? 'Finalizing...' : 'Finalize & Submit'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EPRF;