import React from 'react';
import type { EPRFForm, CommonIntervention } from '../../types';
import { Section, inputBaseClasses } from './FormControls';
import TaggableInput from '../TaggableInput';
import { PlusIcon, TrashIcon } from '../icons';
import { DRUG_DATABASE } from '../../utils/drugDatabase';

interface Step5Props {
    state: EPRFForm;
    dispatch: React.Dispatch<any>;
    setWitnessModalOpen: (isOpen: boolean) => void;
    setMedicationToWitnessIndex: (index: number) => void;
}

const CONTROLLED_DRUGS = ['morphine', 'diazepam', 'midazolam', 'ketamine', 'fentanyl'];
const commonImpressions = [ 'ACS', 'Anaphylaxis', 'Asthma', 'CVA / Stroke', 'DKA', 'Drug Overdose', 'Ethanol Intoxication', 'Fall', 'Fracture', 'GI Bleed', 'Head Injury', 'Hypoglycaemia', 'Mental Health Crisis', 'Minor Injury', 'Post-ictal', 'Seizure', 'Sepsis', 'Shortness of Breath', 'Syncope', 'Trauma' ];
const commonItemsUsed = ['Large Dressing', 'Gauze', 'Triangular Bandage', 'Wound Closure Strips', 'Saline Pod', 'Catastrophic Tourniquet', 'Air-sickness Bag', 'Ice Pack'];
const commonInterventions: CommonIntervention[] = ['Wound Care', 'Splinting', 'Airway Management', 'IV Cannulation', 'Medication Administered', 'CPR', 'Defibrillation', 'Patient Positioning', 'C-Spine Immobilisation', 'Other'];

const Step5_Treatment: React.FC<Step5Props> = ({ state, dispatch, setWitnessModalOpen, setMedicationToWitnessIndex }) => {
    
    const handleDynamicListChange = (listName: 'medicationsAdministered' | 'interventions', index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newList = [...state[listName]];
        (newList[index] as any) = { ...newList[index], [e.target.name]: e.target.value };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: newList});

        if (listName === 'medicationsAdministered' && e.target.name === 'medication') {
            const isCd = CONTROLLED_DRUGS.some(cd => e.target.value.toLowerCase().includes(cd));
            if (isCd) {
                setMedicationToWitnessIndex(index);
                setWitnessModalOpen(true);
            }
        }
    };

    const addDynamicListItem = (listName: 'medicationsAdministered' | 'interventions') => {
        let newItem;
        if (listName === 'medicationsAdministered') newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), medication: '', dose: '', route: 'PO' as const };
        else if (listName === 'interventions') newItem = { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0].substring(0, 5), intervention: 'Wound Care' as CommonIntervention, details: '' };
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: [...state[listName], newItem]});
    };

    const removeDynamicListItem = (listName: 'medicationsAdministered' | 'interventions', index: number) => {
        dispatch({type: 'UPDATE_DYNAMIC_LIST', listName, payload: state[listName].filter((_, i) => i !== index)});
    };
    
    return (
        <div>
            <Section title="Clinical Impression & Treatment">
                <TaggableInput label="Working Impressions" value={state.impressions} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'impressions', payload: v})} suggestions={commonImpressions} placeholder="e.g., Asthma, Minor Head Injury..." />
            </Section>
            <Section title="Medications Administered">
                <datalist id="drug-db-list">
                    {DRUG_DATABASE.map(med => <option key={med} value={med} />)}
                </datalist>
                 <div className="md:col-span-4 space-y-2">
                    {state.medicationsAdministered.map((med, index) => (
                         <div key={med.id}>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
                                <input type="time" name="time" value={med.time} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={inputBaseClasses} />
                                <input list="drug-db-list" type="text" name="medication" value={med.medication} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} placeholder="Medication" className={`${inputBaseClasses} md:col-span-2`} />
                                <input type="text" name="dose" value={med.dose} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} placeholder="Dose" className={inputBaseClasses} />
                                <div className="flex gap-2 items-center">
                                    <select name="route" value={med.route} onChange={e => handleDynamicListChange('medicationsAdministered', index, e)} className={inputBaseClasses}>
                                         <option>PO</option><option>IV</option><option>IM</option><option>SC</option><option>SL</option><option>PR</option><option>Nebulised</option><option>Other</option>
                                    </select>
                                    <button type="button" onClick={() => removeDynamicListItem('medicationsAdministered', index)} className="p-2 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                            {med.isControlledDrug && med.witness && (
                                <div className="text-xs p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-md mt-1">
                                    Witnessed by: <strong>{med.witness.name}</strong> | Batch: {med.batchNumber} | Wasted: {med.amountWasted || 'None'}
                                </div>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={() => addDynamicListItem('medicationsAdministered')} className="flex items-center text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300"><PlusIcon className="w-4 h-4 mr-1"/> Add Medication</button>
                </div>
            </Section>
            <Section title="Interventions">
                <div className="md:col-span-4 space-y-2">
                    {state.interventions.map((item, index) => (
                        <div key={item.id} className="flex gap-2 items-start">
                            <input type="time" name="time" value={item.time} onChange={(e) => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} w-28`} />
                            <select name="intervention" value={item.intervention} onChange={e => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} flex-grow`}>
                                {commonInterventions.map(i => <option key={i}>{i}</option>)}
                            </select>
                            <input type="text" name="details" value={item.details} onChange={(e) => handleDynamicListChange('interventions', index, e)} className={`${inputBaseClasses} flex-grow`} placeholder="Details..."/>
                            <button type="button" onClick={() => removeDynamicListItem('interventions', index)} className="p-2 text-red-500 hover:text-red-700 mt-1"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                    <button type="button" onClick={() => addDynamicListItem('interventions')} className="flex items-center text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300"><PlusIcon className="w-4 h-4 mr-1"/> Add Intervention</button>
                </div>
            </Section>
             <Section title="Items Used">
                <TaggableInput label="Consumable Items Used" value={state.itemsUsed} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'itemsUsed', payload: v})} suggestions={commonItemsUsed} placeholder="e.g., Large Dressing, Gauze..." />
             </Section>
        </div>
    );
};

export default Step5_Treatment;
