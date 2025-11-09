// FIX: Import 'useEffect' from react.
import React, { useEffect } from 'react';
import type { EPRFForm, VitalSign, Injury } from '../../types';
import { Section, inputBaseClasses } from './FormControls';
import { CheckboxField } from './FormControls';
import SpeechEnabledTextArea from '../SpeechEnabledTextArea';
import { PlusIcon, TrashIcon } from '../icons';
import VitalsChart from '../VitalsChart';
import { InteractiveBodyMap } from '../InteractiveBodyMap';
import { calculateNews2Score } from '../../utils/news2Calculator';

interface Step4Props {
    state: EPRFForm;
    dispatch: React.Dispatch<any>;
}

const Step4_VitalsInjuries: React.FC<Step4Props> = ({ state, dispatch }) => {
    
    useEffect(() => {
        const newVitals = state.vitals.map(v => ({...v, news2: calculateNews2Score(v)}));
        if (JSON.stringify(newVitals) !== JSON.stringify(state.vitals)) {
            dispatch({ type: 'UPDATE_VITALS', payload: newVitals});
        }
    }, [state.vitals, dispatch]);

    const handleVitalChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newVitals = [...state.vitals];
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        newVitals[index] = { ...newVitals[index], [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value };
        dispatch({ type: 'UPDATE_VITALS', payload: newVitals });
    };

    const addVitalSign = () => dispatch({ type: 'UPDATE_VITALS', payload: [...state.vitals, { time: new Date().toTimeString().split(' ')[0].substring(0, 5), hr: '', rr: '', bp: '', spo2: '', temp: '', bg: '', painScore: '0', avpu: 'Alert', onOxygen: false }]});
    const removeVitalSign = (index: number) => dispatch({ type: 'UPDATE_VITALS', payload: state.vitals.filter((_, i) => i !== index) });
    
    const handleInjuriesChange = (newInjuries: Injury[]) => {
        dispatch({ type: 'UPDATE_INJURIES', payload: newInjuries });
    };

    return (
        <div>
            <Section title="Vital Signs">
                <div className="md:col-span-4 space-y-2">
                    {state.vitals.map((vital, index) => (
                        <div key={index} className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2 items-center">
                            <input type="time" name="time" value={vital.time} onChange={e => handleVitalChange(index, e)} className={inputBaseClasses} />
                            <input type="number" name="hr" value={vital.hr} onChange={e => handleVitalChange(index, e)} placeholder="HR" className={inputBaseClasses} />
                            <input type="number" name="rr" value={vital.rr} onChange={e => handleVitalChange(index, e)} placeholder="RR" className={inputBaseClasses} />
                            <input type="text" name="bp" value={vital.bp} onChange={e => handleVitalChange(index, e)} placeholder="BP" className={inputBaseClasses} />
                            <input type="number" name="spo2" value={vital.spo2} onChange={e => handleVitalChange(index, e)} placeholder="SpO2" className={inputBaseClasses} />
                            <input type="number" step="0.1" name="temp" value={vital.temp} onChange={e => handleVitalChange(index, e)} placeholder="Temp" className={inputBaseClasses} />
                            <input type="number" step="0.1" name="bg" value={vital.bg} onChange={e => handleVitalChange(index, e)} placeholder="BG" className={inputBaseClasses} />
                            <input type="number" name="painScore" value={vital.painScore} onChange={e => handleVitalChange(index, e)} placeholder="Pain" className={inputBaseClasses} />
                            <CheckboxField label="On O2?" name="onOxygen" checked={vital.onOxygen} onChange={e => handleVitalChange(index, e)} />
                            <button type="button" onClick={() => removeVitalSign(index)} className="p-2 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                     <button type="button" onClick={addVitalSign} className="flex items-center text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300">
                        <PlusIcon className="w-4 h-4 mr-1"/> Add Vital Set
                    </button>
                </div>
                {state.vitals.length > 1 && <div className="md:col-span-4"><VitalsChart vitals={state.vitals} /></div>}
            </Section>
            <Section title="Secondary Survey & Injuries">
                <SpeechEnabledTextArea label="Secondary Survey Findings" name="secondarySurvey" value={state.secondarySurvey} onChange={e => dispatch({type: 'UPDATE_FIELD', field: 'secondarySurvey', payload: e.target.value})} />
                <div className="md:col-span-4"><InteractiveBodyMap value={state.injuries} onChange={handleInjuriesChange} /></div>
            </Section>
        </div>
    );
};

export default Step4_VitalsInjuries;