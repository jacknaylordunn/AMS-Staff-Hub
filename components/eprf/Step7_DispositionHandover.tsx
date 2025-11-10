

import React, { useRef, useState } from 'react';
import type { EPRFForm, User as AppUser, Attachment } from '../../types';
// FIX: Imported 'inputBaseClasses' from FormControls to resolve the 'Cannot find name' error.
import { Section, SelectField, InputField, labelBaseClasses, inputBaseClasses } from './FormControls';
import SpeechEnabledTextArea from '../SpeechEnabledTextArea';
import SignaturePad, { SignaturePadRef } from '../SignaturePad';
import { PlusIcon, DocsIcon, CameraIcon, SpinnerIcon, CheckIcon, SparklesIcon, TrashIcon } from '../icons';
import { functions } from '../../services/firebase';
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
            const newCrew = [...state.crewMembers, { uid: member.uid, name: `${member.firstName} ${member.lastName}`.trim() }];
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
            if (e.target) {
                e.target.value = '';
            }
        }
    };
    
    const removeAttachment = (id: string) => {
        dispatch({ type: 'UPDATE_ATTACHMENTS', payload: state.attachments.filter(att => att.id !== id) });
    };
    
    const handleGenerateSummary = async () => {
        setIsSummarizing(true);
        showToast("Generating handover summary...", "info");
        const askClinicalAssistant = functions.httpsCallable('askClinicalAssistant');
        try {
            const systemInstruction = "You are a clinical assistant. Summarize the provided ePRF JSON data into a concise SBAR (Situation, Background, Assessment, Recommendation) handover report suitable for a hospital emergency department. Focus on clinically relevant information. Be clear and direct.";
            const context = {
                presentation: state.presentingComplaint, 
                history: state.history,
                vitals: state.vitals.slice(-1)[0], // Only the latest vitals
                assessment: {
                    avpu: state.disability.avpu,
                    gcs: state.disability.gcs.total,
                    airway: state.airway,
                    breathing: state.breathing,
                },
                treatment: state.medicationsAdministered.map(m => `${m.medication} ${m.dose}`).join(', ') || 'None',
                disposition: state.disposition,
            };
            const query = `${systemInstruction}\n\nDATA:\n${JSON.stringify(context)}`;

            const result = await askClinicalAssistant({ query });
            const summary = (result.data as { response: string }).response;
            dispatch({ type: 'UPDATE_FIELD', field: 'handoverDetails', payload: `${state.handoverDetails ? state.handoverDetails + '\n\n' : ''}AI Generated Summary:\n${summary}`});
            showToast("AI handover summary generated.", "success");
        } catch (err) {
            console.error("AI summary generation failed:", err);
            showToast("Failed to generate AI summary.", "error");
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div>
            <Section title="Disposition & Handover">
                <SelectField label="Final Disposition*" name="disposition" value={state.disposition} onChange={handleChange} className="md:col-span-2" required>
                    <option value="Not Set">-- Not Set --</option>
                    <option>Conveyed to ED</option>
                    <option>Left at Home (Own Consent)</option>
                    <option>Left at Home (Against Advice)</option>
                    <option>Referred to Other Service</option>
                    <option>Deceased on Scene</option>
                </SelectField>
                {state.disposition === 'Conveyed to ED' && (
                    <>
                        <InputField label="Destination" name="destination" value={state.dispositionDetails.destination} onChange={e => handleNestedChange('dispositionDetails', 'destination', e)} className="md:col-span-2" />
                        <InputField label="Handover To (Name/Role)" name="handoverTo" value={state.dispositionDetails.handoverTo} onChange={e => handleNestedChange('dispositionDetails', 'handoverTo', e)} className="md:col-span-2" />
                    </>
                )}
                 {state.disposition === 'Referred to Other Service' && (
                    <InputField label="Referral Details" name="referralDetails" value={state.dispositionDetails.referralDetails} onChange={e => handleNestedChange('dispositionDetails', 'referralDetails', e)} className="md:col-span-4" />
                )}
                <SpeechEnabledTextArea label="Handover Details / SBAR" name="handoverDetails" value={state.handoverDetails} onChange={e => handleChange(e as any)} rows={6} />
                <div className="md:col-span-4">
                    <button type="button" onClick={handleGenerateSummary} disabled={isSummarizing} className="flex items-center gap-2 text-sm px-4 py-2 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-200">
                        {isSummarizing ? <SpinnerIcon className="w-5 h-5"/> : <SparklesIcon className="w-5 h-5" />}
                        Generate AI Handover Summary
                    </button>
                </div>
            </Section>
            
            <Section title="Crew & Attachments">
                <div className="md:col-span-2">
                    <label className={labelBaseClasses}>Attending Crew</label>
                    <ul className="mt-2 space-y-2">
                        {state.crewMembers.map(c => (
                            <li key={c.uid} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                                <span>{c.name}</span>
                                {c.uid !== user?.uid && <button type="button" onClick={() => handleRemoveCrewMember(c.uid)} className="text-red-500"><TrashIcon className="w-4 h-4"/></button>}
                            </li>
                        ))}
                    </ul>
                    <div className="flex gap-2 mt-2">
                        <select value={selectedCrewMember} onChange={e => setSelectedCrewMember(e.target.value)} className={inputBaseClasses + ' flex-grow'}>
                            <option value="">-- Add Crew Member --</option>
                            {allStaff.filter(s => !state.crewMembers.some(c => c.uid === s.uid)).map(s => <option key={s.uid} value={s.uid}>{s.firstName} {s.lastName}</option>)}
                        </select>
                        <button type="button" onClick={handleAddCrewMember} className="px-3 bg-gray-200 rounded-md"><PlusIcon className="w-5 h-5"/></button>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label className={labelBaseClasses}>Attachments</label>
                    <div className="mt-2 space-y-2">
                        {state.attachments.map(att => (
                            <div key={att.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                                    <DocsIcon className="w-4 h-4"/>
                                    <span className="truncate">{att.fileName}</span>
                                </a>
                                <button type="button" onClick={() => removeAttachment(att.id)} className="text-red-500"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center text-sm px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-md w-full justify-center">
                            <PlusIcon className="w-5 h-5 mr-2"/> Upload File
                        </button>
                        <button type="button" onClick={() => setCameraModalOpen(true)} className="flex items-center text-sm px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-md w-full justify-center">
                            <CameraIcon className="w-5 h-5 mr-2"/> Take Photo
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" multiple />
                    </div>
                    {isUploading && <div className="flex items-center mt-2 text-sm"><SpinnerIcon className="w-4 h-4 mr-2"/>Uploading...</div>}
                </div>
            </Section>

            <Section title="Signatures">
                <div className="md:col-span-2">
                    <label className={labelBaseClasses}>Lead Clinician Signature</label>
                    <SignaturePad ref={clinicianSigRef} />
                </div>
                <div className="md:col-span-2">
                    <label className={labelBaseClasses}>Patient / Guardian Signature</label>
                    <SignaturePad ref={patientSigRef} />
                </div>
            </Section>
            
            <Section title="Finalize & Submit">
                <div className="md:col-span-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            const clinicianSig = clinicianSigRef.current?.getSignature();
                            const patientSig = patientSigRef.current?.getSignature();
                            onFinalize(clinicianSig, patientSig);
                        }}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400"
                    >
                        {isSaving ? <SpinnerIcon className="w-6 h-6" /> : <CheckIcon className="w-6 h-6" />}
                        {isSaving ? 'Submitting...' : 'Finalize and Submit ePRF'}
                    </button>
                </div>
            </Section>
        </div>
    );
};

export default Step7_DispositionHandover;