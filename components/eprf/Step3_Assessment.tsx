import React from 'react';
import type { EPRFForm } from '../../types';
import { Section, InputField, SelectField, FieldWrapper, labelBaseClasses, CheckboxField } from './FormControls';
import SpeechEnabledTextArea from '../SpeechEnabledTextArea';

interface Step3Props {
    state: EPRFForm;
    dispatch: React.Dispatch<any>;
}

const Step3_Assessment: React.FC<Step3Props> = ({ state, dispatch }) => {
    
    const handleNestedChange = (field: string, subField: string, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const target = e.target as HTMLInputElement;
        const payload = target.type === 'checkbox' ? target.checked : target.value;
        dispatch({ type: 'UPDATE_NESTED_FIELD', field, subField, payload });
    };

    const handleCheckboxArrayChange = (field: string, subField: string, e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'UPDATE_CHECKBOX_ARRAY', field, subField, value: e.target.name, checked: e.target.checked });
    
    const handleGCSChange = (e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'UPDATE_GCS', field: e.target.name, payload: parseInt(e.target.value, 10)});
    
    return (
        <div>
            <Section title="Primary Survey (ABCDE)">
                <FieldWrapper className="md:col-span-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <label className={labelBaseClasses}>Airway</label>
                        <SelectField label="Status" name="status" value={state.airwayDetails.status} onChange={(e) => handleNestedChange('airwayDetails', 'status', e)}>
                            <option>Clear</option><option>Partially Obstructed</option><option>Obstructed</option>
                        </SelectField>
                        <div className="flex gap-4 mt-2">{['OPA', 'NPA', 'i-gel', 'LMA'].map(adj => <CheckboxField key={adj} label={adj} name={adj} checked={state.airwayDetails.adjuncts.includes(adj as any)} onChange={e => handleCheckboxArrayChange('airwayDetails', 'adjuncts', e)} />)}</div>
                        <SpeechEnabledTextArea label="Airway Notes" name="airway" value={state.airway} onChange={e => dispatch({type: 'UPDATE_FIELD', field: 'airway', payload: e.target.value})} rows={2} className="mt-2"/>
                    </div>
                     <div>
                         <label className={labelBaseClasses}>Breathing</label>
                        <SelectField label="Effort" name="effort" value={state.breathingDetails.effort} onChange={(e) => handleNestedChange('breathingDetails', 'effort', e)}>
                            <option>Normal</option><option>Shallow</option><option>Labored</option><option>Gasping</option>
                        </SelectField>
                        <div className="flex gap-4 mt-2">{['Clear', 'Wheeze', 'Crackles', 'Stridor', 'Reduced/Absent'].map(s => <CheckboxField key={s} label={s} name={s} checked={state.breathingDetails.sounds.includes(s as any)} onChange={e => handleCheckboxArrayChange('breathingDetails', 'sounds', e)} />)}</div>
                        <div className="flex gap-4 mt-2">{['Bilaterally', 'Left', 'Right'].map(s => <CheckboxField key={s} label={s} name={s} checked={state.breathingDetails.sides.includes(s as any)} onChange={e => handleCheckboxArrayChange('breathingDetails', 'sides', e)} />)}</div>
                        <SpeechEnabledTextArea label="Breathing Notes" name="breathing" value={state.breathing} onChange={e => dispatch({type: 'UPDATE_FIELD', field: 'breathing', payload: e.target.value})} rows={2} className="mt-2"/>
                    </div>
                    <div>
                         <label className={labelBaseClasses}>Circulation</label>
                        <SelectField label="Pulse Quality" name="pulseQuality" value={state.circulationDetails.pulseQuality} onChange={(e) => handleNestedChange('circulationDetails', 'pulseQuality', e)}>
                            <option>Strong</option><option>Weak</option><option>Thready</option><option>Bounding</option><option>Absent</option>
                        </SelectField>
                        <SelectField label="Skin" name="skin" value={state.circulationDetails.skin} onChange={(e) => handleNestedChange('circulationDetails', 'skin', e)}>
                            <option>Normal</option><option>Pale</option><option>Cyanosed</option><option>Flushed</option><option>Clammy</option><option>Jaundiced</option>
                        </SelectField>
                         <InputField label="Cap Refill (secs)" name="capillaryRefillTime" value={state.circulationDetails.capillaryRefillTime} onChange={e => handleNestedChange('circulationDetails', 'capillaryRefillTime', e)} />
                         <InputField label="Heart Sounds" name="heartSounds" value={state.circulationDetails.heartSounds} onChange={e => handleNestedChange('circulationDetails', 'heartSounds', e)} />
                        <SpeechEnabledTextArea label="Circulation Notes" name="circulation" value={state.circulation} onChange={e => dispatch({type: 'UPDATE_FIELD', field: 'circulation', payload: e.target.value})} rows={2} className="mt-2"/>
                    </div>
                    <div>
                        <SpeechEnabledTextArea label="Exposure Notes" name="exposure" value={state.exposure} onChange={e => dispatch({type: 'UPDATE_FIELD', field: 'exposure', payload: e.target.value})} rows={2} className="mt-2"/>
                    </div>
                </FieldWrapper>
            </Section>
            <Section title="Neurological Assessment">
                <SelectField label="AVPU" name="avpu" value={state.disability.avpu} onChange={(e) => handleNestedChange('disability', 'avpu', e)}>
                    <option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option>
                </SelectField>
                <div className="md:col-span-3 lg:col-span-3 grid grid-cols-4 gap-4 items-end">
                    <SelectField label="GCS Eyes" name="eyes" value={state.disability.gcs.eyes} onChange={handleGCSChange}>
                        {[4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
                    </SelectField>
                    <SelectField label="GCS Verbal" name="verbal" value={state.disability.gcs.verbal} onChange={handleGCSChange}>
                         {[5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
                    </SelectField>
                    <SelectField label="GCS Motor" name="motor" value={state.disability.gcs.motor} onChange={handleGCSChange}>
                         {[6,5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
                    </SelectField>
                     <div className="p-2 text-center bg-gray-100 dark:bg-gray-700 rounded-md">
                        <span className="text-sm">Total: </span>
                        <span className="font-bold text-lg text-ams-blue dark:text-ams-light-blue">{state.disability.gcs.total}</span>
                     </div>
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <InputField label="Left Pupil Size (mm)" name="leftSize" value={state.disability.pupils.leftSize} onChange={e => handleNestedChange('disability.pupils', 'leftSize', e)} />
                    <SelectField label="Left Pupil Response" name="leftResponse" value={state.disability.pupils.leftResponse} onChange={e => handleNestedChange('disability.pupils', 'leftResponse', e)}><option>Normal</option><option>Sluggish</option><option>Fixed</option></SelectField>
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <InputField label="Right Pupil Size (mm)" name="rightSize" value={state.disability.pupils.rightSize} onChange={e => handleNestedChange('disability.pupils', 'rightSize', e)} />
                    <SelectField label="Right Pupil Response" name="rightResponse" value={state.disability.pupils.rightResponse} onChange={e => handleNestedChange('disability.pupils', 'rightResponse', e)}><option>Normal</option><option>Sluggish</option><option>Fixed</option></SelectField>
                </div>
                <InputField label="Blood Glucose (mmol/L)" name="bloodGlucoseLevel" value={state.disability.bloodGlucoseLevel || ''} onChange={(e) => handleNestedChange('disability', 'bloodGlucoseLevel', e)} />
                <div className="md:col-span-3 grid grid-cols-3 gap-4">
                    <SelectField label="FAST - Face" name="face" value={state.disability.fastTest?.face || 'Normal'} onChange={(e) => handleNestedChange('disability.fastTest', 'face', e)}>
                        <option>Normal</option><option>Abnormal</option>
                    </SelectField>
                    <SelectField label="FAST - Arms" name="arms" value={state.disability.fastTest?.arms || 'Normal'} onChange={(e) => handleNestedChange('disability.fastTest', 'arms', e)}>
                        <option>Normal</option><option>Abnormal</option>
                    </SelectField>
                    <SelectField label="FAST - Speech" name="speech" value={state.disability.fastTest?.speech || 'Normal'} onChange={(e) => handleNestedChange('disability.fastTest', 'speech', e)}>
                         <option>Normal</option><option>Abnormal</option>
                    </SelectField>
                </div>
                <div className="md:col-span-4 lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t pt-4 mt-4">
                     <SelectField label="L Arm Power" name="luPower" value={state.limbAssessment.luPower} onChange={e => handleNestedChange('limbAssessment', 'luPower', e)}>{[5,4,3,2,1,0].map(v=><option key={v} value={v}>{v}</option>)}</SelectField>
                     <SelectField label="L Arm Sensation" name="luSensation" value={state.limbAssessment.luSensation} onChange={e => handleNestedChange('limbAssessment', 'luSensation', e)}><option>Normal</option><option>Reduced</option><option>Absent</option></SelectField>
                     <SelectField label="R Arm Power" name="ruPower" value={state.limbAssessment.ruPower} onChange={e => handleNestedChange('limbAssessment', 'ruPower', e)}>{[5,4,3,2,1,0].map(v=><option key={v} value={v}>{v}</option>)}</SelectField>
                     <SelectField label="R Arm Sensation" name="ruSensation" value={state.limbAssessment.ruSensation} onChange={e => handleNestedChange('limbAssessment', 'ruSensation', e)}><option>Normal</option><option>Reduced</option><option>Absent</option></SelectField>
                     <SelectField label="L Leg Power" name="llPower" value={state.limbAssessment.llPower} onChange={e => handleNestedChange('limbAssessment', 'llPower', e)}>{[5,4,3,2,1,0].map(v=><option key={v} value={v}>{v}</option>)}</SelectField>
                     <SelectField label="L Leg Sensation" name="llSensation" value={state.limbAssessment.llSensation} onChange={e => handleNestedChange('limbAssessment', 'llSensation', e)}><option>Normal</option><option>Reduced</option><option>Absent</option></SelectField>
                     <SelectField label="R Leg Power" name="rlPower" value={state.limbAssessment.rlPower} onChange={e => handleNestedChange('limbAssessment', 'rlPower', e)}>{[5,4,3,2,1,0].map(v=><option key={v} value={v}>{v}</option>)}</SelectField>
                     <SelectField label="R Leg Sensation" name="rlSensation" value={state.limbAssessment.rlSensation} onChange={e => handleNestedChange('limbAssessment', 'rlSensation', e)}><option>Normal</option><option>Reduced</option><option>Absent</option></SelectField>
                </div>

            </Section>
            <Section title="Pain Assessment (OPQRST)">
                <InputField label="Onset" name="onset" value={state.painAssessment.onset} onChange={e => handleNestedChange('painAssessment', 'onset', e)} />
                <InputField label="Provocation / Palliation" name="provocation" value={state.painAssessment.provocation} onChange={e => handleNestedChange('painAssessment', 'provocation', e)} />
                <InputField label="Quality" name="quality" value={state.painAssessment.quality} onChange={e => handleNestedChange('painAssessment', 'quality', e)} />
                <InputField label="Radiation" name="radiation" value={state.painAssessment.radiation} onChange={e => handleNestedChange('painAssessment', 'radiation', e)} />
                <InputField label="Time" name="time" value={state.painAssessment.time} onChange={e => handleNestedChange('painAssessment', 'time', e)} />
                 <div className="md:col-span-3">
                    <label className={labelBaseClasses}>Severity: {state.painAssessment.severity}/10</label>
                    <input type="range" name="severity" min="0" max="10" value={state.painAssessment.severity} onChange={e => handleNestedChange('painAssessment', 'severity', e)} className="w-full" />
                </div>
            </Section>
        </div>
    );
};

export default Step3_Assessment;
