import React, { useRef, useState } from 'react';
import type { EPRFForm, User as AppUser, Attachment } from '../../types';
import { Section, SelectField, InputField, labelBaseClasses } from './FormControls';
import SpeechEnabledTextArea from '../SpeechEnabledTextArea';
import SignaturePad, { SignaturePadRef } from '../SignaturePad';
import { PlusIcon, DocsIcon, CameraIcon, SpinnerIcon, CheckIcon } from '../icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../services/firebase';
import { showToast } from '../Toast';

interface Step7Props {
    state: EPRFForm;
    dispatch: React.Dispatch<any>;
    allStaff: AppUser[];
    user: AppUser | null;
    isSaving: boolean;
    onFinalize: (clinicianSig: string | null, patientSig: string | null) => Promise<void>;
    isUploading: boolean;
    setCameraModalOpen: (isOpen: boolean) => void;
    uploadAndAddAttachment: (file: File, fileName: string) => Promise<void>;
}

const Step7_DispositionHandover: React.FC<Step7Props> = ({ state, dispatch, allStaff, user, isSaving, onFinalize, isUploading, setCameraModalOpen, uploadAndAddAttachment }) => {
    
    const clinicianSigRef = useRef<SignaturePadRef>(null);
    const patientSigRef = useRef<SignaturePadRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedCrewMember, setSelectedCrewMember] = useState<string>('');
    const [isSummarizing, setIsSummarizing] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        dispatch({ type: 'UPDATE_FIELD', field: e.target.name, payload: e.target.value });
    };

    const handleNestedChange = (field: string, subField: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        dispatch({ type: 'UPDATE_NESTED_FIELD', field, subField, payload: e.target.value });
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

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach((file: File) => {
                uploadAndAddAttachment(file, file.name);
            });
            // Clear the input value to allow re-uploading the same file
            if (e.target) {
                e.target.value = '';
            }
        }
    };
    
    const removeAttachment = (id: string) => {
        // Note: This doesn't delete the file from storage, only removes the reference.
        dispatch({ type: 'UPDATE_ATTACHMENTS', payload: state.attachments.filter(att => att.id !== id) });
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
    
    const triggerFinalize = () => {
        const clinicianSig = clinicianSigRef.current?.getSignature();
        const patientSig = patientSigRef.current?.getSignature();
        onFinalize(clinicianSig || null, patientSig || null);
    };

    return (
        <div>
            <Section title="Final Disposition">
                 <SelectField label="Disposition*" name="disposition" value={state.disposition} onChange={handleChange} className="md:col-span-2" required>
                    <option value="Not Set">-- Select --</option>
                    <option>Conveyed to ED</option>
                    <option>Left at Home (Own Consent)</option>
                    <option>Left at Home (Against Advice)</option>
                    <option>Referred to Other Service</option>
                    <option>Deceased on Scene</option>
                </SelectField>
                 {state.disposition === 'Conveyed to ED' && (
                    <>
                         <InputField label="Destination*" name="destination" value={state.dispositionDetails.destination} onChange={e => handleNestedChange('dispositionDetails', 'destination', e)} className="md:col-span-2" />
                         <InputField label="Handover To" name="handoverTo" value={state.dispositionDetails.handoverTo} onChange={e => handleNestedChange('dispositionDetails', 'handoverTo', e)} />
                    </>
                )}
                {state.disposition === 'Referred to Other Service' && (
                    <InputField label="Referral Details" name="referralDetails" value={state.dispositionDetails.referralDetails} onChange={e => handleNestedChange('dispositionDetails', 'referralDetails', e)} className="md:col-span-4" />
                )}
            </Section>
            <Section title="Handover & Signatures">
                <div className="md:col-span-4">
                    <SpeechEnabledTextArea label="Clinical Handover (SBAR)" name="handoverDetails" value={state.handoverDetails} onChange={e => handleChange(e as any)} rows={6} />
                    <button onClick={handleGenerateSummary} disabled={isSummarizing} className="mt-2 flex items-center gap-2 text-sm px-4 py-2 bg-ams-blue/10 text-ams-blue rounded-md hover:bg-ams-blue/20 dark:bg-ams-light-blue/20 dark:text-ams-light-blue">
                         {isSummarizing ? <SpinnerIcon className="w-5 h-5"/> : <SpinnerIcon className="w-5 h-5" />} Generate AI Handover Summary
                    </button>
                </div>
                 <div className="md:col-span-2">
                    <label className={labelBaseClasses}>Lead Clinician Signature</label>
                    <SignaturePad ref={clinicianSigRef} />
                 </div>
                 <div className="md:col-span-2">
                    <label className={labelBaseClasses}>Patient / Guardian Signature</label>
                     <SignaturePad ref={patientSigRef} />
                </div>
                <div className="md:col-span-4 flex justify-end">
                    <button onClick={triggerFinalize} disabled={isSaving} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 flex items-center">
                        {isSaving && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                        Finalize for Review
                    </button>
                </div>
            </Section>
            <Section title="Attachments">
                <div className="md:col-span-4 flex gap-4">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-sm px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300">
                        <DocsIcon className="w-5 h-5"/> Upload File
                    </button>
                    <button type="button" onClick={() => setCameraModalOpen(true)} className="flex items-center gap-2 text-sm px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300">
                       <CameraIcon className="w-5 h-5" /> Take Photo
                    </button>
                     <input type="file" ref={fileInputRef} onChange={handleFileSelected} multiple className="hidden" />
                     {isUploading && <SpinnerIcon className="w-5 h-5 text-ams-blue inline-block ml-4" />}
                </div>
                 {state.attachments.length > 0 && (
                    <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {state.attachments.map(att => (
                            <div key={att.id} className="relative group">
                                <a href={att.url} target="_blank" rel="noopener noreferrer">
                                    {att.mimeType.startsWith("image/") ? <img src={att.url} alt={att.fileName} className="w-full h-24 object-cover rounded-md"/> : 
                                        <div className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center"><DocsIcon className="w-8 h-8 text-gray-400" /></div>
                                    }
                                    <p className="text-xs truncate mt-1">{att.fileName}</p>
                                </a>
                                 <button onClick={() => removeAttachment(att.id)} className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 text-xs">✖</button>
                            </div>
                        ))}
                    </div>
                )}
            </Section>
            <Section title="Crew Members">
                 <div className="md:col-span-3 flex gap-2 items-end">
                    <SelectField label="Add Crew Member" name="crew-member" value={selectedCrewMember} onChange={e => setSelectedCrewMember(e.target.value)}>
                        <option value="">-- Select --</option>
                        {allStaff.filter(s => !state.crewMembers.some(c => c.uid === s.uid)).map(s => <option key={s.uid} value={s.uid}>{s.firstName} {s.lastName}</option>)}
                    </SelectField>
                    <button onClick={handleAddCrewMember} className="px-4 py-2 bg-ams-light-blue text-white rounded-md h-fit mb-0.5"><PlusIcon className="w-5 h-5"/></button>
                </div>
                 <div className="md:col-span-4">
                    <div className="flex flex-wrap gap-2">
                        {state.crewMembers.map(member => (
                            <span key={member.uid} className="flex items-center gap-2 bg-gray-200 dark:bg-gray-600 text-sm font-semibold px-2 py-1 rounded-full">
                                {member.name}
                                <button type="button" onClick={() => handleRemoveCrewMember(member.uid)} className="text-red-500 hover:text-red-700 font-bold text-lg leading-none">&times;</button>
                            </span>
                        ))}
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default Step7_DispositionHandover;