import React, { useState, useEffect } from 'react';
import * as firestore from 'firebase/firestore';
import type { Shift, EventLog, User as AppUser } from '../types';
import { SpinnerIcon, TrashIcon } from './icons';
import ConfirmationModal from './ConfirmationModal';
import { showToast } from './Toast';
import { bidOnShift, cancelBidOnShift } from '../services/rotaService';

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
    refreshShifts: () => Promise<void>;
}

const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose, onSave, onDelete, shift, date, events, staff, type, currentUser, refreshShifts }) => {
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
    const isMyBid = shift?.bids?.some(b => b.uid === currentUser.uid);


    useEffect(() => {
        const selectedDate = shift?.start.toDate() || date || new Date();
        const yyyyMMdd = selectedDate.toISOString().split('T')[0];

        if (shift) {
            setFormData({
                eventId: shift.eventId,
                eventName: shift.eventName,
                start: shift.start.toDate().toISOString().slice(0, 16),
                end: shift.end.toDate().toISOString().slice(0, 16),
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
    }, [shift, date, events, type, currentUser, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        // Create a mutable copy of the form data to update
        let newFormData = { ...formData, [name]: value };

        // Handle multi-day shift logic
        if ((name === "start" || name === "end") && newFormData.start && newFormData.end) {
            const startDate = new Date(newFormData.start);
            const endDate = new Date(newFormData.end);

            if (endDate < startDate) {
                const nextDayEndDate = new Date(startDate);
                // Get time parts from the intended end date
                const endHours = endDate.getHours();
                const endMinutes = endDate.getMinutes();
                // Set the date to the start date, then add a day
                nextDayEndDate.setDate(nextDayEndDate.getDate() + 1);
                nextDayEndDate.setHours(endHours, endMinutes);

                // Format back to YYYY-MM-DDTHH:mm
                const formattedNextDay = nextDayEndDate.toISOString().slice(0, 16);
                newFormData.end = formattedNextDay;
            }
        }
        
        // Handle event name update when eventId changes
        if (name === "eventId") {
             const selectedEvent = events.find(ev => ev.id === value);
             if(selectedEvent) {
                newFormData = { ...newFormData, eventId: value, eventName: selectedEvent.name };
             }
        }
        
        setFormData(newFormData);
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
                const staffMember = staff.find(s => s.uid === uid) || (currentUser.uid === uid ? currentUser : null);
                const userFullName = staffMember ? `${staffMember.firstName} ${staffMember.lastName}`.trim() : 'Unknown User';
                return { uid, name: userFullName };
            });
            
            const shiftData = {
                eventId: formData.eventId,
                eventName: formData.eventName,
                start: firestore.Timestamp.fromDate(new Date(formData.start)),
                end: firestore.Timestamp.fromDate(new Date(formData.end)),
                roleRequired: formData.roleRequired,
                notes: formData.notes,
                assignedStaff,
                assignedStaffUids: formData.assignedStaffUids,
                isUnavailability: formData.isUnavailability,
                unavailabilityReason: formData.unavailabilityReason,
                bids: shift?.bids || [],
                // FIX: Widened type of status to allow for conditional assignment.
                status: 'Open' as Shift['status'] // Default status
            };

            if (formData.assignedStaffUids.length > 0 && !formData.isUnavailability) {
                shiftData.status = 'Assigned';
            }

            await onSave(shiftData as Omit<Shift, 'id'>);
            onClose();
        } catch (error) {
            console.error("Failed to save shift from modal:", error);
            showToast('Failed to save shift.', 'error');
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
            onClose(); // Close the main modal as well
        }
    }
    
    const handleBid = async () => {
        if (!shift?.id) return;
        setLoading(true);
        try {
            if (isMyBid) {
                await cancelBidOnShift(shift.id, currentUser.uid);
                showToast("Bid withdrawn.", "success");
            } else {
                await bidOnShift(shift.id, { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}`.trim() });
                showToast("You have bid on this shift.", "success");
            }
            await refreshShifts();
            onClose();
        } catch (e) {
            showToast("Failed to process bid.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    
    const title = type === 'unavailability' 
        ? (shift ? 'Edit Unavailability' : 'Add Unavailability')
        : (shift ? 'Edit Shift' : 'Create New Shift');

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center modal-overlay" 
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto modal-content" onClick={e => e.stopPropagation()}>
                <h2 id="shift-modal-title" className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue mb-6">{title}</h2>
                <form onSubmit={handleSubmit}>
                    {type === 'shift' ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClasses}>Event</label>
                                <select name="eventId" value={formData.eventId} onChange={handleChange} required className={inputClasses} disabled={!isManager}>
                                    {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClasses}>Role Required</label>
                                <select name="roleRequired" value={formData.roleRequired} onChange={handleChange} required className={inputClasses} disabled={!isManager}>
                                    <option>First Aider</option>
                                    <option>FREC3</option>
                                    <option>FREC4/ECA</option>
                                    <option>FREC5/EMT/AAP</option>
                                    <option>Paramedic</option>
                                    <option>Nurse</option>
                                    <option>Doctor</option>
                                    <option>Welfare</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClasses}>Start Time</label>
                                <input type="datetime-local" name="start" value={formData.start} onChange={handleChange} required className={inputClasses} disabled={!isManager} />
                            </div>
                            <div>
                                <label className={labelClasses}>End Time</label>
                                <input type="datetime-local" name="end" value={formData.end} onChange={handleChange} required className={inputClasses} disabled={!isManager} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className={labelClasses}>Assigned Staff</label>
                            <select multiple name="assignedStaffUids" value={formData.assignedStaffUids} onChange={handleStaffSelect} className={`${inputClasses} h-32`} disabled={!isManager}>
                                {staff.map(s => <option key={s.uid} value={s.uid}>{s.firstName} {s.lastName}</option>)}
                            </select>
                        </div>
                        <div className="mt-4">
                            <label className={labelClasses}>Notes</label>
                            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClasses} disabled={!isManager} />
                        </div>
                    </>
                    ) : ( // type === 'unavailability'
                    <>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className={labelClasses}>Start Time</label>
                                <input type="datetime-local" name="start" value={formData.start} onChange={handleChange} required className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>End Time</label>
                                <input type="datetime-local" name="end" value={formData.end} onChange={handleChange} required className={inputClasses} />
                            </div>
                        </div>
                         <div className="mt-4">
                            <label className={labelClasses}>Reason (optional)</label>
                            <input type="text" name="unavailabilityReason" value={formData.unavailabilityReason} onChange={handleChange} className={inputClasses} />
                        </div>
                    </>
                    )}

                    {/* Bidding and Bids display */}
                    {shift && !isManager && shift.assignedStaff.length === 0 && !shift.isUnavailability && (
                        <div className="mt-4 pt-4 border-t dark:border-gray-600">
                             <button type="button" onClick={handleBid} disabled={loading} className={`w-full px-4 py-2 font-semibold text-white rounded-md flex items-center justify-center ${isMyBid ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}>
                                {loading && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                                {isMyBid ? 'Withdraw Bid' : 'Bid for this Shift'}
                            </button>
                        </div>
                    )}
                     {shift && isManager && shift.bids && shift.bids.length > 0 && (
                        <div className="mt-4 pt-4 border-t dark:border-gray-600">
                            <h3 className="font-semibold mb-2">Bids ({shift.bids.length})</h3>
                            <ul className="space-y-1 text-sm">
                                {shift.bids.map(bid => <li key={bid.uid}>{bid.name}</li>)}
                            </ul>
                        </div>
                    )}
                    
                    <div className="flex justify-between items-center mt-6">
                        <div>
                            {shift && (isManager || (shift.isUnavailability && shift.assignedStaffUids.includes(currentUser.uid))) && (
                                <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center">
                                    <TrashIcon className="w-5 h-5 mr-2"/> Delete
                                </button>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                             { (isManager || type === 'unavailability') &&
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                                    {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
                                    Save
                                </button>
                            }
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShiftModal;