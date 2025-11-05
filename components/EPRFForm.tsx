import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import type { EPRFForm, Patient, VitalSign, MedicationAdministered, Intervention, Injury, WelfareLogEntry, User as AppUser, Attachment, EventLog } from '../types';
import { PlusIcon, TrashIcon, SpinnerIcon, CheckIcon, CameraIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, EventsIcon, SparklesIcon, QuestionMarkCircleIcon, ShieldExclamationIcon } from '../components/icons';
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
import { getGeminiClient, handleGeminiError } from '../services/geminiService';

interface EPRFFormProps {
    initialEPRFData: EPRFForm;
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

const EPRFForm: React.FC<EPRFFormProps> = ({ initialEPRFData }) => {
    const { user } = useAuth();
    const { activeEvent, updateOpenEPRFDraft, removeEPRFDraft, setActiveEPRFId, openEPRFDrafts, activeEPRFId } = useAppContext();
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
    }, []);

     // Sync local reducer state back to global context
    useEffect(() => {
        updateOpenEPRFDraft(state);
    }, [state, updateOpenEPRFDraft]);

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
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
            
            // Remove from open drafts and navigate
            if (activeEPRFId === state.id) {
                const draftIndex = openEPRFDrafts.findIndex(d => d.id === state.id);
                const nextDraft = openEPRFDrafts[draftIndex - 1] || openEPRFDrafts[draftIndex + 1];
                setActiveEPRFId(nextDraft?.id || null);
            }
            removeEPRFDraft(state.id!);

            if(openEPRFDrafts.length <= 1) { // if it was the last one
                navigate('/dashboard');
            }
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
        const ai = await getGeminiClient();
        if (!ai) {
             setIsSummarizing(false);
             return;
        }

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

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Generate an SBAR handover for this patient: ${JSON.stringify(context)}`,
                config: { systemInstruction },
            });
            
            dispatch({ type: 'UPDATE_FIELD', field: 'handoverDetails', payload: result.text });
            showToast("Handover summary generated.", "success");

        } catch (err) {
            handleGeminiError(err);
        } finally {
            setIsSummarizing(false);
        }
    };
    
    const handleSafeguardingCheck = async () => {
        if (!safeguardingCheckText) return;

        setIsSummarizing(true); // Reuse loading state
        showToast("Analyzing for safeguarding concerns...", "info");
        const ai = await getGeminiClient();
        if (!ai) {
             setIsSummarizing(false);
             return;
        }
        
        try {
            const systemInstruction = "You are a safeguarding advisor for UK paramedics. Analyze the provided text for potential child or vulnerable adult safeguarding concerns. Your response must be a single paragraph. If concerns are present, briefly state what they are (e.g., 'Unexplained injuries, conflicting stories'). If no obvious concerns are present, state that. Start your response with 'Based on the text provided...'. Do not give advice, only identify potential indicators.";

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: safeguardingCheckText,
                config: { systemInstruction },
            });

            dispatch({ type: 'UPDATE_NESTED_FIELD', field: 'safeguarding', subField: 'details', payload: `${state.safeguarding.details}\n\nAI Safeguarding Check:\n${result.text}` });
            showToast("Safeguarding analysis complete.", "success");
            setShowSafeguardingPrompt(false);
        } catch (err) {
             handleGeminiError(err);
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleSaveDraft = async () => {
        setSaveStatus('saving');
        try {
            await updateEPRF(state.id!, state);
            setSaveStatus(isOnline ? 'saved-online' : 'saved-offline');
            showToast("Draft saved!", "success");
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error("Manual save failed:", error);
            setSaveStatus('error');
            showToast("Failed to save draft.", "error");
        }
    };
    
    const handleDeleteDraft = async () => {
        setIsDeleting(true);
        try {
            await deleteEPRF(state.id!);
    
            if (activeEPRFId === state.id) {
                const draftIndex = openEPRFDrafts.findIndex(d => d.id === state.id);
                const nextDraft = openEPRFDrafts[draftIndex - 1] || openEPRFDrafts[draftIndex + 1];
                setActiveEPRFId(nextDraft?.id || null);
            }
            removeEPRFDraft(state.id!);
            showToast("Draft deleted.", "success");
    
            if (openEPRFDrafts.length <= 1) { 
                navigate('/dashboard');
            }
        } catch (error) {
            showToast("Failed to delete draft.", "error");
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    return (
        <div>
            <SaveStatusIndicator status={saveStatus} />
            <PatientModal isOpen={isPatientModalOpen} onClose={() => setPatientModalOpen(false)} onSave={handleSaveNewPatient} />
            <ValidationModal isOpen={isValidationModalOpen} onClose={() => setValidationModalOpen(false)} errors={validationErrors} />
            <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setQuickAddOpen(false)} onSave={handleQuickAdd} />
            <GuidelineAssistantModal isOpen={isGuidelineModalOpen} onClose={() => setGuidelineModalOpen(false)} />
             <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteDraft}
                title="Delete ePRF Draft"
                message="Are you sure you want to permanently delete this draft? This action cannot be undone."
                confirmText="Delete"
                isLoading={isDeleting}
            />

            {/* Stepper UI */}
            <div className="mb-4 sticky top-[144px] z-10 bg-ams-gray dark:bg-gray-900 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-center">
                    {steps.map((step, index) => (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center text-center">
                                <button
                                    onClick={() => setCurrentStep(index + 1)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${
                                        currentStep === index + 1 ? 'bg-ams-blue text-white ring-4 ring-ams-light-blue/50' : currentStep > index + 1 ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-200'
                                    }`}
                                >
                                    {currentStep > index + 1 ? <CheckIcon className="w-5 h-5"/> : index + 1}
                                </button>
                                <p className={`mt-1 text-xs w-20 break-words ${currentStep === index + 1 ? 'text-ams-blue dark:text-ams-light-blue font-semibold' : 'text-gray-500'}`}>{step}</p>
                            </div>
                            {index < steps.length - 1 && <div className={`flex-auto border-t-2 mt-4 mx-2 transition-colors duration-500 ${currentStep > index + 1 ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Form Content */}
            <form onSubmit={(e) => e.preventDefault()}>
                {/* Step 1: Incident */}
                {currentStep === 1 && (
                    <Section title={steps[0]}>
                        <SelectField label="Presentation Type" name="presentationType" value={state.presentationType} onChange={handleChange}>
                            <option>Medical/Trauma</option>
                            <option>Minor Injury</option>
                            <option>Welfare/Intox</option>
                        </SelectField>

                        <InputField label="Incident Date" name="incidentDate" value={state.incidentDate} onChange={handleChange} type="date" required />
                        
                        <FieldWrapper>
                            <label className={labelBaseClasses}>Incident Time</label>
                            <div className="flex items-center gap-2">
                                <input type="time" name="incidentTime" value={state.incidentTime} onChange={handleChange} required className={inputBaseClasses} />
                                <button type="button" onClick={handleSetTimeToNow('incidentTime')} className="p-2 bg-gray-200 rounded-md dark:bg-gray-600"><ClockIcon className="w-5 h-5"/></button>
                            </div>
                        </FieldWrapper>

                        <FieldWrapper className="lg:col-span-2">
                            <label htmlFor="incidentNumber" className={labelBaseClasses}>Incident #</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input 
                                    type="text" 
                                    id="incidentNumber" 
                                    name="incidentNumber" 
                                    value={state.incidentNumber} 
                                    readOnly 
                                    placeholder="Click generate..."
                                    className={`${inputBaseClasses} !mt-0 bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed`} 
                                />
                                {!state.incidentNumber && (
                                    <button 
                                        type="button" 
                                        onClick={handleGenerateIncidentNumber}
                                        disabled={isSaving}
                                        className="px-4 py-2 text-sm bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400"
                                    >
                                        {isSaving ? <SpinnerIcon className="w-4 h-4" /> : 'Generate'}
                                    </button>
                                )}
                            </div>
                        </FieldWrapper>

                        <InputField label="Location of Incident" name="incidentLocation" value={state.incidentLocation} onChange={handleChange} className="lg:col-span-2" />
                    </Section>
                )}
                
                {/* Step 2: Patient */}
                 {currentStep === 2 && (
                    <Section title={steps[1]}>
                        {/* Patient Search */}
                        <div className="relative md:col-span-2 lg:col-span-4">
                            <label className={labelBaseClasses}>Search Existing Patient</label>
                            <input
                                type="text"
                                value={patientSearch}
                                onChange={e => setPatientSearch(e.target.value)}
                                placeholder="Search by name or DOB (YYYY-MM-DD)..."
                                className={inputBaseClasses}
                            />
                            {searchLoading && <SpinnerIcon className="absolute right-3 top-9 w-5 h-5 text-gray-400" />}
                            {searchResults.length > 0 && (
                                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border rounded-md shadow-lg">
                                    {searchResults.map(p => (
                                        <li key={p.id} onClick={() => handleSelectPatient(p)} className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                                            {p.firstName} {p.lastName} ({p.dob})
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="md:col-span-2 lg:col-span-4 flex items-center justify-between">
                            <p className="text-sm text-gray-500">OR</p>
                            <button type="button" onClick={() => setPatientModalOpen(true)} className="px-4 py-2 text-sm bg-ams-blue text-white rounded-md">Create New Patient</button>
                        </div>
                        
                        <InputField label="Patient Name" name="patientName" value={state.patientName} onChange={handleChange} required />
                        <InputField label="Age" name="patientAge" value={state.patientAge} onChange={handleChange} type="number" />
                        <SelectField label="Gender" name="patientGender" value={state.patientGender} onChange={handleChange}>
                            <option>Unknown</option><option>Male</option><option>Female</option><option>Other</option>
                        </SelectField>
                        {state.patientId && <button type="button" onClick={() => dispatch({type: 'CLEAR_PATIENT'})} className="text-sm text-red-500 self-end mb-2">Clear Patient</button>}
                    </Section>
                )}


            </form>
            
             {/* Navigation and Actions */}
            <div className="mt-8 flex justify-between items-center">
                <button onClick={() => setCurrentStep(s => Math.max(1, s - 1))} disabled={currentStep === 1} className="px-6 py-2 bg-gray-300 dark:bg-gray-600 rounded-md disabled:opacity-50 flex items-center">
                    <ChevronLeftIcon className="w-5 h-5 mr-1" /> Previous
                </button>
                <div className="flex items-center gap-2">
                    <button onClick={() => setQuickAddOpen(true)} className="px-4 py-2 bg-ams-light-blue text-white font-semibold rounded-md flex items-center gap-2"><PlusIcon className="w-5 h-5" /> Quick Add</button>
                    <button onClick={() => setGuidelineModalOpen(true)} className="px-4 py-2 bg-ams-blue text-white font-semibold rounded-md flex items-center gap-2"><SparklesIcon className="w-5 h-5" /> AI Assistant</button>
                </div>
                {currentStep === steps.length ? (
                    <div className="flex gap-4">
                        {/* No finalize button on last step, moved to bottom bar */}
                    </div>
                ) : (
                    <button onClick={() => setCurrentStep(s => Math.min(steps.length, s + 1))} className="px-6 py-2 bg-gray-300 dark:bg-gray-600 rounded-md flex items-center">
                        Next <ChevronRightIcon className="w-5 h-5 ml-1" />
                    </button>
                )}
            </div>

            <div className="mt-8 pt-6 border-t dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button 
                    type="button" 
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="px-6 py-2 bg-red-600 text-white font-bold rounded-md"
                >
                    Delete Draft
                </button>
                <div className="flex gap-4">
                    <button 
                        type="button" 
                        onClick={handleSaveDraft}
                        disabled={isSaving}
                        className="px-6 py-2 bg-gray-500 text-white font-bold rounded-md"
                    >
                        Save Draft
                    </button>
                    <button 
                        onClick={handleFinalize} 
                        disabled={isSaving} 
                        className="px-6 py-2 bg-green-600 text-white font-bold rounded-md flex items-center"
                    >
                         {isSaving ? <SpinnerIcon className="w-5 h-5 mr-2" /> : <CheckIcon className="w-5 h-5 mr-2" />}
                        Finalize & Submit
                    </button>
                </div>
            </div>

        </div>
    );
};
export default EPRFForm;
