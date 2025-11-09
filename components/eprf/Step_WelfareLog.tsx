import React from 'react';
import type { EPRFForm } from '../../types';
import { Section, inputBaseClasses } from './FormControls';
import SpeechEnabledTextArea from '../SpeechEnabledTextArea';
import { PlusIcon, TrashIcon } from '../icons';

interface WelfareLogProps {
    state: EPRFForm;
    dispatch: React.Dispatch<any>;
}

const Step_WelfareLog: React.FC<WelfareLogProps> = ({ state, dispatch }) => {
    
    const handleDynamicListChange = (listName: 'welfareLog', index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const newList = [...state[listName]];
        (newList[index] as any) = { ...newList[index], [e.target.name]: e.target.value };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: newList});
    };

    const addDynamicListItem = (listName: 'welfareLog') => {
        const newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), observation: '' };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: [...state[listName], newItem]});
    };

    const removeDynamicListItem = (listName: 'welfareLog', index: number) => {
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: state[listName].filter((_, i) => i !== index)});
    };

    return (
        <Section title="Welfare Log">
            <SpeechEnabledTextArea 
                label="Initial Presentation / Situation" 
                name="presentingComplaint" 
                value={state.presentingComplaint} 
                onChange={e => dispatch({type: 'UPDATE_FIELD', field: 'presentingComplaint', payload: e.target.value})} 
            />
            <div className="md:col-span-4 space-y-2">
                {state.welfareLog.map((entry, index) => (
                    <div key={entry.id} className="flex gap-2 items-start">
                        <input 
                            type="time" 
                            name="time" 
                            value={entry.time} 
                            onChange={(e) => handleDynamicListChange('welfareLog', index, e)} 
                            className={`${inputBaseClasses} w-28`} 
                        />
                        <input 
                            type="text" 
                            name="observation" 
                            value={entry.observation} 
                            onChange={(e) => handleDynamicListChange('welfareLog', index, e)} 
                            className={`${inputBaseClasses} flex-grow`} 
                            placeholder="Observation or action taken..." 
                        />
                        <button 
                            type="button" 
                            onClick={() => removeDynamicListItem('welfareLog', index)} 
                            className="p-2 text-red-500 hover:text-red-700 mt-1"
                        >
                            <TrashIcon className="w-5 h-5"/>
                        </button>
                    </div>
                ))}
                <button 
                    type="button" 
                    onClick={() => addDynamicListItem('welfareLog')} 
                    className="flex items-center text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300"
                >
                    <PlusIcon className="w-4 h-4 mr-1"/> Add Log Entry
                </button>
            </div>
        </Section>
    );
};

export default Step_WelfareLog;
