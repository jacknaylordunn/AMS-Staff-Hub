

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { Shift, EventLog, User as AppUser } from '../types';
import { SpinnerIcon, TrashIcon } from './icons';
import ConfirmationModal from './ConfirmationModal';
import { showToast } from './Toast';

interface ShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (shift: Omit<Shift, 'id'>) => Promise<void>;
    onDelete: (shiftId: string) => Promise<void>;
    shift: Shift | null;
    date: Date | null;
    events: EventLog[];
    staff: AppUser[];
    type: 'shift' | 'unavailability';
    currentUser: AppUser;
}

const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose, onSave, onDelete, shift, date, events, staff, type, currentUser }) => {
    const [formData, setFormData] = useState({
        eventId: '',
        eventName: '',
        start: '',
        end: '',
        roleRequired: 'First Aider',
        notes: '',
        assignedStaffUids: [] as string[],
        isUnavailability: false,
        unavailabilityReason: '',
    });
    const [loading, setLoading] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const isManager = currentUser.role === 'Manager' || currentUser.role === 'Admin';


    useEffect(() => {
        const selectedDate = shift?.start.toDate() || date || new Date();
        const yyyyMMdd = selectedDate.toISOString().split('T')[0];

        if (shift) {
            setFormData({
                eventId: shift.eventId,
                eventName: shift.eventName,
                start: `${yyyyMMdd}T${shift.start.toDate().toTimeString().substring(0,5)}`,
                end: `${yyyyMMdd}T${shift.end.toDate().toTimeString().substring(0,5)}`,
                roleRequired: shift.roleRequired,
                notes: shift.notes || '',
                assignedStaffUids: shift.assignedStaff.map(s => s.uid),
                isUnavailability: shift.isUnavailability || false,
                unavailabilityReason: shift.unavailabilityReason || '',
            });
        } else {
             const defaultStart = type === 'unavailability' ? `${yyyyMMdd}T00:00` : `${yyyyMMdd}T09:00`;
             const defaultEnd = type === 'unavailability' ? `${yyyyMMdd}T23:59` : `${yyyyMMdd}T17:00`;
            setFormData({
                eventId: events[0]?.id || '',
                eventName: events[0]?.name || '',
                start: defaultStart,
                end: defaultEnd,
                roleRequired: 'First Aider',
                notes: '',
                assignedStaffUids: type === 'unavailability' ? [currentUser.uid] : [],
                isUnavailability: type === 'unavailability',
                unavailabilityReason: '',
            });
        }
    }, [shift, date, events, type, currentUser]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === "eventId") {
             const selectedEvent = events.find(ev => ev.id === value);
             setFormData(prev => ({ ...prev, eventId: value, eventName: selectedEvent?.name || '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleStaffSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedUids = Array.from(e.target.selectedOptions, option => (option as HTMLOptionElement).value);
        setFormData(prev => ({...prev, assignedStaffUids: selectedUids}));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const assignedStaff = formData.assignedStaffUids.map(uid => {
                const staffMember = staff.find(s => s.uid === uid);
                const userFullName = staffMember ? `${staffMember.firstName} ${staffMember.lastName}`.trim() : `${currentUser.firstName} ${currentUser.lastName}`.trim();
                return { uid, name: userFullName };
            });
            
            const shiftData = {
                eventId: formData.eventId,
                eventName: formData.eventName,
                start: Timestamp.fromDate(new Date(formData.start)),
                end: Timestamp.fromDate(new Date(formData.end)),
                roleRequired: formData.roleRequired,
                notes: formData.notes,
                assignedStaff,
                assignedStaffUids: formData.assignedStaffUids,
                isUnavailability: formData.isUnavailability,
                unavailabilityReason: formData.unavailabilityReason,
            };
            await onSave(shiftData as Omit<Shift, 'id'>);
            onClose(); // Close the modal on successful save
        } catch (error) {
            console.error("Failed to save shift from modal:", error);
            // Error toast should be handled by the onSave implementation
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!shift) return;
        setIsDeleting(true);
        try {
            await onDelete(shift.id!);
            showToast(shift.isUnavailability ? "Unavailability removed." : "Shift deleted successfully.", "success");
        } catch (error) {
            showToast(shift.isUnavailability ? "Failed to remove unavailability." : "Failed to delete shift.", "error");
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
        }
    }

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    
    const title = type === 'unavailability' 
        ? (shift ? 'Edit Unavailability' : 'Add Unavailability')
        : (shift ? 'Edit Shift' : 'Create New Shift');

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-modal-title"
        >
            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={type === 'unavailability' ? "Remove Unavailability" : "Delete Shift"}
                message={type === 'unavailability' ? "Are you sure you want to remove this period of unavailability?" : "Are you sure you want to delete this shift? This will remove it from the rota for all assigned staff."}
                confirmText="Delete"
                isLoading={isDeleting}
            />
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 id="shift-modal-title" className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">{title}</h2>
                <form onSubmit={handleSubmit}>
                    {type === 'shift' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className={labelClasses}>Event</label>
                            <select name="eventId" value={formData.eventId} onChange={handleChange} required className={inputClasses}>
                                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Role Required</label>
                             <select name="roleRequired" value={formData.roleRequired} onChange={handleChange} required className={inputClasses}>
                                <option>First Aider</option>
                                <option>FREC3</option>
                                <option>FREC4/ECA</option>
                                <option>FREC5/EMT/AAP</option>
                                <option>Paramedic</option>
                                <option>Nurse</option>
                                <option>Doctor</option>
                                <option>Welfare</option>
                                <option>Admin</option>
                                <option>Manager</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Start Time</label>
                            <input type="datetime-local" name="start" value={formData.start} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>End Time</label>
                            <input type="datetime-local" name="end" value={formData.end} onChange={handleChange} required className={inputClasses}/>
                        </div>
                         <div className="md:col-span-2">
                             <label className={labelClasses}>Assign Staff</label>
                             <select multiple name="assignedStaffUids" value={formData.assignedStaffUids} onChange={handleStaffSelect} className={`${inputClasses} h-32`}>
                                 {staff.map(s => <option key={s.uid} value={s.uid}>{s.firstName} {s.lastName} ({s.role})</option>)}
                             </select>
                        </div>
                        <div className="md:col-span-2">
                             <label className={labelClasses}>Notes</label>
                             <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClasses}/>
                        </div>
                    </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Start Date</label>
                            <input type="datetime-local" name="start" value={formData.start} onChange={handleChange} required className={inputClasses}/>
                        </div>
                         <div>
                            <label className={labelClasses}>End Date</label>
                            <input type="datetime-local" name="end" value={formData.end} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClasses}>Reason (Optional)</label>
                             <input type="text" name="unavailabilityReason" value={formData.unavailabilityReason} onChange={handleChange} className={inputClasses}/>
                        </div>
                    </div>
                    )}
                    <div className="flex justify-between items-center gap-4 mt-6">
                         <div>
                            {shift?.id && (isManager || shift.assignedStaffUids.includes(currentUser.uid)) && (
                                <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center">
                                    <TrashIcon className="w-5 h-5 mr-2" /> Delete
                                </button>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                            <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                                {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                                Save
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShiftModal;