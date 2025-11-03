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
}

const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose, onSave, onDelete, shift, date, events, staff }) => {
    const [formData, setFormData] = useState({
        eventId: '',
        eventName: '',
        start: '',
        end: '',
        roleRequired: 'First Aider',
        notes: '',
        assignedStaffUids: [] as string[],
    });
    const [loading, setLoading] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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
            });
        } else {
            setFormData({
                eventId: events[0]?.id || '',
                eventName: events[0]?.name || '',
                start: `${yyyyMMdd}T09:00`,
                end: `${yyyyMMdd}T17:00`,
                roleRequired: 'First Aider',
                notes: '',
                assignedStaffUids: [],
            });
        }
    }, [shift, date, events]);

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
        const selectedUids = Array.from(e.target.selectedOptions, option => option.value);
        setFormData(prev => ({...prev, assignedStaffUids: selectedUids}));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const assignedStaff = formData.assignedStaffUids.map(uid => {
            const staffMember = staff.find(s => s.uid === uid);
            return { uid, name: staffMember?.displayName || 'Unknown' };
        });
        const shiftData: Omit<Shift, 'id' | 'assignedStaffUids'> & { assignedStaff: { uid: string, name: string }[] } = {
            eventId: formData.eventId,
            eventName: formData.eventName,
            start: Timestamp.fromDate(new Date(formData.start)),
            end: Timestamp.fromDate(new Date(formData.end)),
            roleRequired: formData.roleRequired,
            notes: formData.notes,
            assignedStaff,
        };
        await onSave(shiftData as Omit<Shift, 'id'>);
        setLoading(false);
    };

    const handleDeleteConfirm = async () => {
        if (!shift) return;
        setIsDeleting(true);
        try {
            await onDelete(shift.id!);
            showToast("Shift deleted successfully.", "success");
        } catch (error) {
            showToast("Failed to delete shift.", "error");
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
        }
    }

    if (!isOpen) return null;

    const inputClasses = "mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" onClick={onClose}>
            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Shift"
                message="Are you sure you want to delete this shift? This will remove it from the rota for all assigned staff."
                confirmText="Delete"
                isLoading={isDeleting}
            />
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">{shift ? 'Edit Shift' : 'Create New Shift'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className={labelClasses}>Event</label>
                            <select name="eventId" value={formData.eventId} onChange={handleChange} required className={`${inputClasses} bg-white dark:bg-gray-700`}>
                                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Role Required</label>
                             <select name="roleRequired" value={formData.roleRequired} onChange={handleChange} required className={`${inputClasses} bg-white dark:bg-gray-700`}>
                                <option>First Aider</option>
                                <option>EMT</option>
                                <option>Nurse</option>
                                <option>Paramedic</option>
                                <option>Welfare</option>
                                <option>Manager</option>
                                <option>Admin</option>
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
                             <select multiple name="assignedStaffUids" value={formData.assignedStaffUids} onChange={handleStaffSelect} className={`${inputClasses} h-32 bg-white dark:bg-gray-700`}>
                                 {staff.map(s => <option key={s.uid} value={s.uid}>{s.displayName} ({s.role})</option>)}
                             </select>
                        </div>
                        <div className="md:col-span-2">
                             <label className={labelClasses}>Notes</label>
                             <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClasses}/>
                        </div>
                    </div>
                    <div className="flex justify-between items-center gap-4 mt-6">
                         <div>
                            {shift?.id && (
                                <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center">
                                    <TrashIcon className="w-5 h-5 mr-2" /> Delete
                                </button>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                            <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                                {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                                Save Shift
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShiftModal;