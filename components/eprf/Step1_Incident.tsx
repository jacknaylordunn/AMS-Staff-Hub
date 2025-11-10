import React from 'react';
// FIX: Replaced undefined 'EventLog' with 'Shift' to align with current data model.
import type { EPRFForm, Shift } from '../../types';
import { Section, InputField, SelectField } from './FormControls';
import TaggableInput from '../TaggableInput';
import { SpinnerIcon, ClockIcon } from '../icons';
import { getIncidentNumber } from '../../services/eprfService';
import { showToast } from '../Toast';

interface Step1Props {
    state: EPRFForm;
    dispatch: React.Dispatch<any>;
    // FIX: Changed prop name and type from 'availableEvents: EventLog[]' to 'availableShifts: Shift[]'.
    availableShifts: Shift[];
    isSaving: boolean;
}

const Step1_Incident: React.FC<Step1Props> = ({ state, dispatch, availableShifts, isSaving }) => {
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        dispatch({ type: 'UPDATE_FIELD', field: name, payload: value });
    };

    const handleSetTimeToNow = (fieldName: keyof EPRFForm) => () => {
        const timeString = new Date().toTimeString().split(' ')[0].substring(0, 5);
        dispatch({ type: 'UPDATE_FIELD', field: fieldName, payload: timeString });
    };

    const handleGenerateIncidentNumber = async () => {
        if (state.incidentNumber) return; 
        dispatch({ type: 'UPDATE_FIELD', field: 'isSaving', payload: true }); // A bit of a hack to show spinner
        try {
            const newIncidentNumber = await getIncidentNumber();
            dispatch({ type: 'UPDATE_FIELD', field: 'incidentNumber', payload: newIncidentNumber });
            showToast("Incident number generated.", "success");
        } catch (error) {
            showToast("Failed to generate incident number.", "error");
        } finally {
            dispatch({ type: 'UPDATE_FIELD', field: 'isSaving', payload: false });
        }
    };
    
    // FIX: Added handler for shift selection to update multiple fields in the form state.
    const handleShiftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const shiftId = e.target.value;
        const selectedShift = availableShifts.find(s => s.id === shiftId);
        dispatch({ type: 'UPDATE_FIELD', field: 'shiftId', payload: shiftId });
        if (selectedShift) {
            dispatch({ type: 'UPDATE_FIELD', field: 'eventName', payload: selectedShift.eventName });
            dispatch({ type: 'UPDATE_FIELD', field: 'incidentLocation', payload: selectedShift.location });
        }
    };

    const commonAgencies = ['Police', 'Fire & Rescue', 'HART', 'Security'];

    return (
        <div>
            <Section title="Incident & Triage">
                {/* FIX: Changed logic to handle shift selection instead of obsolete eventId. */}
                {!state.shiftId ? (
                    <SelectField label="Select Event*" name="shiftId" value={state.shiftId || ''} onChange={handleShiftChange} className="md:col-span-2" required>
                        <option value="">-- Please select an event --</option>
                        {availableShifts.map(shift => <option key={shift.id} value={shift.id}>{shift.eventName} ({shift.start.toDate().toLocaleDateString()})</option>)}
                    </SelectField>
                ) : (
                    <InputField label="Event Name" name="eventName" value={state.eventName || ''} onChange={handleChange} className="md:col-span-2" disabled/>
                )}
                 <SelectField label="Nature of Call" name="natureOfCall" value={state.natureOfCall} onChange={handleChange}>
                    <option>Emergency</option>
                    <option>Urgent</option>
                    <option>Routine</option>
                    <option>Standby</option>
                </SelectField>
                <SelectField label="Presentation Type" name="presentationType" value={state.presentationType} onChange={handleChange}>
                    <option>Medical/Trauma</option>
                    <option>Minor Injury</option>
                    <option>Welfare/Intox</option>
                </SelectField>
                <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Incident Number*</label>
                    <input type="text" value={state.incidentNumber} readOnly className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 pr-24 bg-gray-100 dark:bg-gray-700/50" placeholder="Click to generate..."/>
                    <button onClick={handleGenerateIncidentNumber} disabled={!!state.incidentNumber || isSaving} className="absolute right-1 top-7 px-3 py-1 text-xs bg-ams-light-blue text-white rounded-md disabled:bg-gray-400">
                       {isSaving ? <SpinnerIcon className="w-4 h-4" /> : 'Generate'}
                    </button>
                </div>
                 <div className="md:col-span-4 lg:col-span-4">
                    <TaggableInput label="Other Agencies on Scene" value={state.otherAgencies || []} onChange={(v) => dispatch({type: 'UPDATE_FIELD', field: 'otherAgencies', payload: v})} suggestions={commonAgencies} placeholder="e.g., Police, Fire..." />
                </div>
            </Section>
            <Section title="Event & Timestamps">
                <InputField label="Location" name="incidentLocation" value={state.incidentLocation} onChange={handleChange} className="md:col-span-4" disabled={!!state.shiftId} />
                <InputField label="Incident Date" name="incidentDate" value={state.incidentDate} onChange={handleChange} type="date" required/>
                <div className="relative"><label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Incident Time*</label><input type="time" name="incidentTime" value={state.incidentTime} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" required /><button type="button" onClick={handleSetTimeToNow('incidentTime')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button></div>
                <div className="relative md:col-span-1"><label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Time of Call</label><input type="time" name="timeOfCall" value={state.timeOfCall || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" /><button type="button" onClick={handleSetTimeToNow('timeOfCall')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button></div>
                <div className="relative md:col-span-1"><label className="block text-sm font-medium text-gray-700 dark:text-gray-400">On Scene Time</label><input type="time" name="onSceneTime" value={state.onSceneTime || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" /><button type="button" onClick={handleSetTimeToNow('onSceneTime')} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-ams-blue"><ClockIcon className="w-4 h-4" /></button></div>
            </Section>
        </div>
    );
};

export default Step1_Incident;
