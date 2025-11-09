import React from 'react';
import type { EPRFForm } from '../../types';
import { Section, SelectField, labelBaseClasses, CheckboxField } from './FormControls';
import SpeechEnabledTextArea from '../SpeechEnabledTextArea';
import { ShieldExclamationIcon } from '../icons';

interface Step6Props {
    state: EPRFForm;
    dispatch: React.Dispatch<any>;
    setSafeguardingModalOpen: (isOpen: boolean) => void;
}

const Step6_SafeguardingCapacity: React.FC<Step6Props> = ({ state, dispatch, setSafeguardingModalOpen }) => {
    
    const handleNestedChange = (field: string, subField: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const target = e.target as HTMLInputElement;
        const payload = target.type === 'checkbox' ? target.checked : target.value;
        dispatch({ type: 'UPDATE_NESTED_FIELD', field, subField, payload });
    };

    const handleCheckboxArrayChange = (field: string, subField: string, e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'UPDATE_CHECKBOX_ARRAY', field, subField, value: e.target.name, checked: e.target.checked });

    return (
        <div>
            <Section title="Safeguarding">
                 <div className="md:col-span-4">
                    <label className={labelBaseClasses}>Are there any safeguarding concerns?</label>
                    <div className="mt-2 flex flex-wrap gap-4">
                        {['Child', 'Adult', 'Domestic Abuse', 'Vulnerable Adult'].map(c => <CheckboxField key={c} label={c} name={c} checked={state.safeguarding.concerns.includes(c as any)} onChange={e => handleCheckboxArrayChange('safeguarding', 'concerns', e)} />)}
                    </div>
                </div>
                <SpeechEnabledTextArea label="Safeguarding Details" name="details" value={state.safeguarding.details} onChange={e => handleNestedChange('safeguarding', 'details', e)} />
                <div className="md:col-span-4">
                    <button type="button" onClick={() => setSafeguardingModalOpen(true)} className="flex items-center gap-2 text-sm px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200">
                        <ShieldExclamationIcon className="w-5 h-5" /> Run AI Safeguarding Check
                    </button>
                </div>
            </Section>
             <Section title="Mental Capacity Assessment">
                <div className="md:col-span-4">
                    <label className={labelBaseClasses}>Does the patient demonstrate the ability to:</label>
                    <div className="mt-2 flex flex-wrap gap-4">
                        {['Understands', 'Retains', 'Weighs', 'Communicates'].map(c => <CheckboxField key={c} label={c} name={c} checked={state.mentalCapacity.assessment.includes(c as any)} onChange={e => handleCheckboxArrayChange('mentalCapacity', 'assessment', e)} />)}
                    </div>
                </div>
                 <SelectField label="Assessment Outcome" name="outcome" value={state.mentalCapacity.outcome} onChange={e => handleNestedChange('mentalCapacity', 'outcome', e)} className="md:col-span-2">
                     <option>Not Assessed</option>
                     <option>Has Capacity</option>
                     <option>Lacks Capacity</option>
                     <option>Fluctuating</option>
                </SelectField>
                <SpeechEnabledTextArea label="Details of Capacity Assessment" name="details" value={state.mentalCapacity.details} onChange={e => handleNestedChange('mentalCapacity', 'details', e)} />
            </Section>
            <Section title="Refusal of Care">
                 <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CheckboxField label="Refused Treatment" name="refusedTreatment" checked={state.refusalOfCare.refusedTreatment} onChange={e => handleNestedChange('refusalOfCare', 'refusedTreatment', e)} />
                    <CheckboxField label="Refused Transport" name="refusedTransport" checked={state.refusalOfCare.refusedTransport} onChange={e => handleNestedChange('refusalOfCare', 'refusedTransport', e)} />
                    <CheckboxField label="Risks Explained" name="risksExplained" checked={state.refusalOfCare.risksExplained} onChange={e => handleNestedChange('refusalOfCare', 'risksExplained', e)} />
                    <CheckboxField label="Capacity Demonstrated" name="capacityDemonstrated" checked={state.refusalOfCare.capacityDemonstrated} onChange={e => handleNestedChange('refusalOfCare', 'capacityDemonstrated', e)} />
                </div>
                <SpeechEnabledTextArea label="Details of Refusal" name="details" value={state.refusalOfCare.details} onChange={e => handleNestedChange('refusalOfCare', 'details', e)} />
            </Section>
        </div>
    );
};

export default Step6_SafeguardingCapacity;
