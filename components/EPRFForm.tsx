import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import * as firestore from 'firebase/firestore';
// FIX: Replaced undefined 'EventLog' with 'Shift' type.
import type { EPRFForm, Patient, VitalSign, MedicationAdministered, Intervention, Injury, WelfareLogEntry, User as AppUser, Attachment, Shift } from '../../types';
import { PlusIcon, TrashIcon, SpinnerIcon, CheckIcon, CameraIcon, ChevronLeftIcon, ChevronRightIcon, QuestionMarkCircleIcon, ShieldExclamationIcon, DocsIcon } from './icons';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { addPatient } from '../services/patientService';
import { updateEPRF, finalizeEPRF, deleteEPRF } from '../services/eprfService';
// FIX: Replaced obsolete 'eventService' with 'rotaService' to fetch shifts.
import { getShiftsForDateRange } from '../services/rotaService';
import { getUsers } from '../services/userService';
import { uploadFile } from '../services/storageService';
import { showToast } from '../components/Toast';
import PatientModal from './PatientModal';
import ConfirmationModal from './ConfirmationModal';
import ValidationModal from './ValidationModal';
import QuickAddModal from './QuickAddModal';
import GuidelineAssistantModal from './GuidelineAssistantModal';
import CameraModal from './CameraModal';
import ControlledDrugWitnessModal from './ControlledDrugWitnessModal';
import { usePatientSearch } from '../hooks/usePatientSearch';
import Step1_Incident from './eprf/Step1_Incident';
import Step2_Patient from './eprf/Step2_Patient';
import Step3_Assessment from './eprf/Step3_Assessment';
import Step4_VitalsInjuries from './eprf/Step4_VitalsInjuries';
import Step5_Treatment from './eprf/Step5_Treatment';
import Step6_SafeguardingCapacity from './eprf/Step6_SafeguardingCapacity';
import Step7_DispositionHandover from './eprf/Step7_DispositionHandover';
import Step_WelfareLog from './eprf/Step_WelfareLog';

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
        const [mainField, nestedField] = field.split('.');

        if (nestedField) { // Handles deep nesting like disability.pupils
             return {
                ...state,
                [mainField]: {
                    ...(state[mainField as keyof EPRFForm] as object),
                    [nestedField]: {
                        ...((state[mainField as keyof EPRFForm] as any)[nestedField]),
                        [subField]: payload
                    }
                }
            }
        }

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
    <nav aria-label="Progress" className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {steps.map((step, stepIdx) => {
            const stepNumber = stepIdx + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            
            let statusClasses = 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700';
            if (isCurrent) {
                statusClasses = 'bg-ams-light-blue/10 dark:bg-ams-light-blue/20 text-ams-blue dark:text-ams-light-blue border-b-4 border-ams-light-blue';
            } else if (isCompleted) {
                statusClasses = 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30';
            }

            return (
                <button
                    key={step}
                    onClick={() => onStepClick(stepNumber)}
                    className={`flex-1 group p-3 text-center text-xs sm:text-sm font-medium transition-colors duration-200 border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${statusClasses}`}
                >
                    <span className="flex items-center justify-center">
                        {isCompleted && <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 hidden sm:inline-block" />}
                        {step}
                    </span>
                </button>
            );
        })}
    </nav>
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

const EPRFFormComponent: React.FC<EPRFFormProps> = ({ initialEPRFData, onComplete }) => {
    const { user } = useAuth();
    const { updateEPRFDraft } = useAppContext();
    const { isOnline } = useOnlineStatus();
    
    const [state, dispatch] = useReducer(eprfReducer, initialEPRFData);
    
    const { patientSearch, setPatientSearch, searchResults, searchLoading } = usePatientSearch();

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPatientModalOpen, setPatientModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isValidationModalOpen, setValidationModalOpen] = useState(false);
    const [isQuickAddOpen, setQuickAddOpen] = useState(false);
    const [isGuidelineModalOpen, setGuidelineModalOpen] = useState(false);
    const [isCameraModalOpen, setCameraModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isWitnessModalOpen, setWitnessModalOpen] = useState(false);
    const [medicationToWitnessIndex, setMedicationToWitnessIndex] = useState<number | null>(null);

    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [allStaff, setAllStaff] = useState<AppUser[]>([]);
    const [seniorClinicians, setSeniorClinicians] = useState<AppUser[]>([]);
    const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
    const [currentStep, setCurrentStep] = useState(1);
    
    const [isSafeguardingModalOpen, setSafeguardingModalOpen] = useState(false);

    const formSteps = {
        'Medical/Trauma': ['Incident', 'Patient', 'Assessment', 'Vitals & Injuries', 'Treatment', 'Safeguarding & Capacity', 'Disposition & Handover'],
        'Minor Injury': ['Incident', 'Patient', 'Assessment', 'Treatment', 'Disposition & Handover'],
        'Welfare/Intox': ['Incident', 'Patient', 'Welfare Log', 'Disposition & Handover'],
    };

    const steps = formSteps[state.presentationType] || formSteps['Medical/Trauma'];

    useEffect(() => {
        if (state) {
            updateEPRFDraft(state);
        }
    }, [state, updateEPRFDraft]);

    useEffect(() => {
        getUsers().then(users => {
            setAllStaff(users);
            const seniors = users.filter(u => u.uid !== user?.uid && ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'].includes(u.role || ''));
            setSeniorClinicians(seniors);
        });
        // FIX: Replaced logic using 'eventId' with 'shiftId' and fetched shifts instead of events.
        if (!state.shiftId) {
            const start = new Date();
            const end = new Date();
            end.setDate(start.getDate() + 90); // Look 90 days ahead for shifts.
            getShiftsForDateRange(start, end).then(shifts => {
                const upcoming = shifts.filter(s => s.status !== 'Completed' && !s.isUnavailability);
                setAvailableShifts(upcoming);
            });
        }
    }, [state.shiftId, user]);

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
    
    const handleSelectPatient = (patient: Patient) => {
        dispatch({ type: 'SELECT_PATIENT', payload: patient });
        setPatientSearch('');
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

    const handlePhotoCaptured = (blob: Blob) => {
        const fileName = `photo_${Date.now()}.jpg`;
        uploadAndAddAttachment(blob, fileName);
    };
    
    const handleSaveWitness = (witnessData: { witness: { uid: string, name: string }, batchNumber: string, amountWasted: string }) => {
        if (medicationToWitnessIndex === null) return;
        
        const newList = [...state.medicationsAdministered];
        newList[medicationToWitnessIndex] = {
            ...newList[medicationToWitnessIndex],
            ...witnessData,
            isControlledDrug: true,
        };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName: 'medicationsAdministered', payload: newList});
        dispatch({ type: 'UPDATE_FIELD', field: 'containsRestrictedDrugs', payload: true });
        setMedicationToWitnessIndex(null);
    };

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
    
    const validateForm = (): boolean => {
        const errors: string[] = [];
        if (!state.shiftId) errors.push("An event/shift must be selected for this report.");
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

    const handleFinalize = async (clinicianSig: string | null, patientSig: string | null) => {
        if (!validateForm()) return;
        setIsSaving(true);
        setSaveStatus('saving');
        try {
            let finalState = {...state};
            let signaturesNeedSync = false;
            if (clinicianSig) {
                finalState.clinicianSignatureUrl = clinicianSig;
                if (!isOnline) signaturesNeedSync = true;
            }
            if (patientSig) {
                finalState.patientSignatureUrl = patientSig;
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
    
    const renderStep = () => {
        const stepName = steps[currentStep-1];
        // FIX: Changed prop name from 'availableEvents' to 'availableShifts' to match Step1_Incident's props.
        const stepProps = { state, dispatch, user, allStaff, availableShifts, isSaving, setWitnessModalOpen, setMedicationToWitnessIndex };
        
        switch (stepName) {
            case 'Incident':
                return <Step1_Incident {...stepProps} />;
            case 'Patient':
                const patientSearchProps = { patientSearch, setPatientSearch, searchResults, searchLoading, handleSelectPatient };
                return <Step2_Patient {...stepProps} {...patientSearchProps} setPatientModalOpen={setPatientModalOpen} />;
            case 'Assessment':
                return <Step3_Assessment {...stepProps} />;
            case 'Vitals & Injuries':
                return <Step4_VitalsInjuries {...stepProps} />;
            case 'Treatment':
                return <Step5_Treatment {...stepProps} />;
            case 'Safeguarding & Capacity':
                return <Step6_SafeguardingCapacity {...stepProps} setSafeguardingModalOpen={setSafeguardingModalOpen} />;
            case 'Disposition & Handover':
                return <Step7_DispositionHandover {...stepProps} onFinalize={handleFinalize} isUploading={isUploading} setCameraModalOpen={setCameraModalOpen} uploadAndAddAttachment={uploadAndAddAttachment} />;
            case 'Welfare Log':
                return <Step_WelfareLog {...stepProps} />;
            default:
                return null;
        }
    };

    return (
        <form onSubmit={e => e.preventDefault()} className="pb-20">
            <div className="bg-white dark:bg-gray-800 mb-6 p-2 sticky top-[128px] z-20">
                 <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />
            </div>

            <SaveStatusIndicator status={saveStatus} />
            <PatientModal isOpen={isPatientModalOpen} onClose={() => setPatientModalOpen(false)} onSave={handleSaveNewPatient} />
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title="Delete ePRF Draft" message="Are you sure you want to permanently delete this ePRF draft?" confirmText="Delete" isLoading={isDeleting} />
            <ValidationModal isOpen={isValidationModalOpen} onClose={() => setValidationModalOpen(false)} errors={validationErrors} />
            <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setQuickAddOpen(false)} onSave={handleQuickAdd} />
            <GuidelineAssistantModal isOpen={isGuidelineModalOpen} onClose={() => setGuidelineModalOpen(false)} />
            <CameraModal isOpen={isCameraModalOpen} onClose={() => setCameraModalOpen(false)} onCapture={handlePhotoCaptured} />
            <ControlledDrugWitnessModal isOpen={isWitnessModalOpen} onClose={() => setWitnessModalOpen(false)} onSave={handleSaveWitness} witnesses={seniorClinicians} />
            {/* Safeguarding Modal would go here */}

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
            
            {renderStep()}

            <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 flex justify-between items-center shadow-top z-30">
                <div className="flex gap-4">
                    <button type="button" onClick={() => setIsDeleteModalOpen(true)} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 flex items-center">
                        {isDeleting ? <SpinnerIcon className="w-5 h-5"/> : <TrashIcon className="w-5 h-5"/>} <span className="hidden sm:inline ml-2">Delete</span>
                    </button>
                     <button type="button" onClick={() => setGuidelineModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-semibold rounded-md">
                        <QuestionMarkCircleIcon className="w-5 h-5" /> <span className="hidden sm:inline">JRCALC AI</span>
                    </button>
                </div>
                 <div className="flex gap-4">
                    <button type="button" onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))} disabled={currentStep === 1} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-semibold rounded-md disabled:opacity-50">
                        <ChevronLeftIcon className="w-5 h-5" /> Prev
                    </button>
                    {currentStep < steps.length && (
                        <button type="button" onClick={() => setCurrentStep(prev => Math.min(steps.length, prev + 1))} className="flex items-center gap-2 px-4 py-2 bg-ams-blue text-white font-semibold rounded-md">
                            Next <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
             <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="fixed bottom-24 right-6 z-40 w-16 h-16 bg-ams-light-blue text-white rounded-full shadow-lg flex items-center justify-center hover:bg-ams-blue transition-colors"
                title="Quick Add"
            >
                <PlusIcon className="w-8 h-8" />
            </button>
        </form>
    );
};

export default EPRFFormComponent;