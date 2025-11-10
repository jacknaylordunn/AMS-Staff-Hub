

import React, { useState, useEffect } from 'react';
// FIX: Use compat firestore types.
// FIX: The 'firestore' named export does not exist on 'firebase/compat/app'. Changed to default import 'firebase' and used 'firebase.firestore' to access types like Timestamp.
import firebase from 'firebase/compat/app';
// FIX: Replaced non-existent 'AppUser' with 'User' type.
import type { Shift, ShiftSlot, User, Vehicle, Kit } from '../types';
import { SpinnerIcon, TrashIcon, PlusIcon, CopyIcon, RefreshIcon } from './icons';
import ConfirmationModal from './ConfirmationModal';
import { showToast } from './Toast';
import { bidOnShift, cancelBidOnShift, assignStaffToSlot } from '../services/rotaService';
import { isRoleOrHigher, ALL_ROLES } from '../utils/roleHelper';
import RepeatShiftModal from './RepeatShiftModal';

interface ShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (shift: Omit<Shift, 'id'>) => Promise<void>;
    onDelete: (shiftId: string) => Promise<void>;
    shift: Shift | null;
    date: Date | null;
    staff: User[];
    vehicles: Vehicle[];
    kits: Kit[];
    type: 'shift' | 'unavailability';
    currentUser: User;
    refreshShifts: () => Promise<void>;
}

const CLINICAL_ROLES = ALL_ROLES.filter(r => !['Pending', 'Admin', 'Manager'].includes(r!));

const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose, onSave, onDelete, shift, date, staff, vehicles, kits, type, currentUser, refreshShifts }) => {
    const [formData, setFormData] = useState({
        eventName: '',
        location: '',
        start: '',
        end: '',
        notes: '',
        isUnavailability: false,
        unavailabilityReason: '',
        assignedVehicleId: '',
        assignedKitIds: [] as string[],
        slots: [] as ShiftSlot[],
    });
    const [loading, setLoading] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRepeatModalOpen, setRepeatModalOpen] = useState(false);
    
    const isManager = currentUser.role === 'Manager' || currentUser.role === 'Admin';

    useEffect(() => {
        if (!isOpen) return;

        const selectedDate = shift?.start.toDate() || date || new Date();
        const yyyyMMdd = selectedDate.toISOString().split('T')[0];

        if (shift) {
            setFormData({
                eventName: shift.eventName,
                location: shift.location,
                start: shift.start.toDate().toISOString().slice(0, 16),
                end: shift.end.toDate().toISOString().slice(0, 16),
                notes: shift.notes || '',
                isUnavailability: shift.isUnavailability || false,
                unavailabilityReason: shift.unavailabilityReason || '',
                assignedVehicleId: shift.assignedVehicleId || '',
                assignedKitIds: shift.assignedKitIds || [],
                slots: JSON.parse(JSON.stringify(shift.slots || [])), // Deep copy
            });
        } else { // New Shift/Unavailability
            const defaultStart = type === 'unavailability' ? `${yyyyMMdd}T00:00` : `${yyyyMMdd}T09:00`;
            const defaultEnd = type === 'unavailability' ? `${yyyyMMdd}T23:59` : `${yyyyMMdd}T17:00`;
            // FIX: Ensure role for unavailability is a valid ShiftSlot role.
            const nonClinicalRoles: Array<User['role']> = ['Admin', 'Manager', 'Pending'];
            const roleForUnavailability = (currentUser.role && !nonClinicalRoles.includes(currentUser.role))
                ? currentUser.role as ShiftSlot['roleRequired']
                : 'First Aider'; // Default for non-clinical roles

            const initialSlots: ShiftSlot[] = type === 'unavailability' ?
                [{ id: 'unavailability-slot', roleRequired: roleForUnavailability, assignedStaff: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }, bids: [] }] :
                [{ id: Date.now().toString(), roleRequired: 'First Aider', assignedStaff: null, bids: [] }];

            setFormData({
                eventName: '',
                location: '',
                start: defaultStart,
                end: defaultEnd,
                notes: '',
                isUnavailability: type === 'unavailability',
                unavailabilityReason: '',
                assignedVehicleId: '',
                assignedKitIds: [],
                slots: initialSlots,
            });
        }
    }, [shift, date, type, currentUser, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        let newFormData = { ...formData, [name]: value };

        if ((name === "start" || name === "end") && newFormData.start && newFormData.end) {
            const startDate = new Date(newFormData.start);
            const endDate = new Date(newFormData.end);
            if (endDate < startDate) {
                const nextDayEndDate = new Date(startDate);
                nextDayEndDate.setDate(nextDayEndDate.getDate() + 1);
                nextDayEndDate.setHours(endDate.getHours(), endDate.getMinutes());
                newFormData.end = nextDayEndDate.toISOString().slice(0, 16);
            }
        }
        
        setFormData(newFormData);
    };

    // Slot management functions for managers
    const addSlot = () => setFormData(prev => ({ ...prev, slots: [...prev.slots, { id: Date.now().toString(), roleRequired: 'First Aider', assignedStaff: null, bids: [] }]}));
    const removeSlot = (id: string) => setFormData(prev => ({ ...prev, slots: prev.slots.filter(s => s.id !== id) }));
    const handleSlotChange = (id: string, field: 'roleRequired', value: any) => {
        setFormData(prev => ({ ...prev, slots: prev.slots.map(s => s.id === id ? { ...s, [field]: value } : s)}));
    };
    
    const handleKitSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedIds = Array.from(e.target.selectedOptions, option => (option as HTMLOptionElement).value);
        setFormData(prev => ({...prev, assignedKitIds: selectedIds}));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (type === 'shift' && formData.slots.length === 0) {
            showToast("A shift must have at least one role slot.", "error");
            return;
        }
        setLoading(true);
        try {
            const shiftData: Omit<Shift, 'id'> = {
                eventName: formData.eventName,
                location: formData.location,
                // FIX: Use compat 'Timestamp'.
                start: firebase.firestore.Timestamp.fromDate(new Date(formData.start)),
                end: firebase.firestore.Timestamp.fromDate(new Date(formData.end)),
                notes: formData.notes,
                isUnavailability: formData.isUnavailability,
                unavailabilityReason: formData.unavailabilityReason,
                slots: formData.slots,
                allAssignedStaffUids: [], // will be calculated in service
                status: 'Open', // will be calculated in service
                assignedVehicleId: formData.assignedVehicleId || undefined,
                assignedVehicleName: vehicles.find(v => v.id === formData.assignedVehicleId)?.name || undefined,
                assignedKitIds: formData.assignedKitIds,
                assignedKitNames: formData.assignedKitIds.map(id => kits.find(k => k.id === id)?.name || 'Unknown'),
            };
            await onSave(shiftData);
            onClose();
        } catch (error) {
            console.error("Failed to save shift:", error);
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
            onClose();
        } catch (error) {
            showToast(shift.isUnavailability ? "Failed to remove unavailability." : "Failed to delete shift.", "error");
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
        }
    };
    
    const handleBid = async (slotId: string) => {
        if (!shift?.id) return;
        setLoading(true);
        try {
            await bidOnShift(shift.id, slotId);
            showToast("You have bid on this shift.", "success");
            await refreshShifts();
            onClose();
        } catch (e: any) {
            console.error(e);
            showToast(e.message || "Failed to process bid.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelBid = async (slotId: string) => {
        if (!shift?.id) return;
        setLoading(true);
        try {
            await cancelBidOnShift(shift.id, slotId);
            showToast("Bid withdrawn.", "success");
            await refreshShifts();
            onClose();
        } catch (e: any) {
            console.error(e);
            showToast(e.message || "Failed to withdraw bid.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (slotId: string, staffMember: { uid: string, name: string }) => {
        if (!shift?.id) return;
        setLoading(true);
        try {
            await assignStaffToSlot(shift.id, slotId, staffMember);
            showToast(`${staffMember.name} has been assigned to the slot.`, "success");
            await refreshShifts();
            onClose();
        } catch (e) {
            showToast("Failed to assign staff.", "error");
        } finally {
            setLoading(false);
        }
    };
    
    const handleUnassign = async (slotId: string) => {
        if (!shift?.id) return;
        setLoading(true);
        try {
            await assignStaffToSlot(shift.id, slotId, null);
            showToast(`Slot has been unassigned.`, "success");
            await refreshShifts();
            onClose();
        } catch (e) {
            showToast("Failed to unassign staff.", "error");
        } finally {
            setLoading(false);
        }
    };


    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    
    const getTitle = () => {
        if (type === 'unavailability') {
            return shift ? 'Edit Unavailability' : 'Add Unavailability';
        }
        // type is 'shift'
        if (isManager) {
            return shift ? 'Edit Shift' : 'Create New Shift';
        }
        // For non-managers, it's a view/bid modal
        return 'View Shift';
    };
    const title = getTitle();

    const renderManagerContent = () => (
         <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClasses}>Event Name</label>
                    <input type="text" name="eventName" value={formData.eventName} onChange={handleChange} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleChange} required className={inputClasses} />
                </div>
                 <div>
                    <label className={labelClasses}>Start Time</label>
                    <input type="datetime-local" name="start" value={formData.start} onChange={handleChange} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>End Time</label>
                    <input type="datetime-local" name="end" value={formData.end} onChange={handleChange} required className={inputClasses} />
                </div>
            </div>

            <div className="mt-6 pt-4 border-t dark:border-gray-600">
                <label className={labelClasses}>Role Slots & Assignments</label>
                <div className="space-y-4 mt-1 p-2 border rounded-md dark:border-gray-600 max-h-64 overflow-y-auto">
                    {formData.slots.map((slot) => {
                        const eligibleStaff = staff.filter(s => isRoleOrHigher(s.role, slot.roleRequired) && !formData.slots.some(sl => sl.assignedStaff?.uid === s.uid));
                        const slotBids = shift?.slots.find(s => s.id === slot.id)?.bids || [];
                        return (
                        <div key={slot.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                            <div className="flex items-center gap-2 justify-between">
                                <select value={slot.roleRequired} onChange={(e) => handleSlotChange(slot.id, 'roleRequired', e.target.value)} className={inputClasses}>
                                    {CLINICAL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button type="button" onClick={() => removeSlot(slot.id)} className="p-2 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                            {slot.assignedStaff ? (
                                <div className="mt-2 flex justify-between items-center">
                                    <p className="font-semibold text-green-600">Assigned: {slot.assignedStaff.name}</p>
                                    <button onClick={() => handleUnassign(slot.id)} disabled={loading} className="px-2 py-0.5 text-xs bg-gray-400 text-white rounded hover:bg-gray-500">Unassign</button>
                                </div>
                            ) : (
                                <div className="mt-2">
                                    <select onChange={(e) => handleAssign(slot.id, JSON.parse(e.target.value))} className={`${inputClasses} text-sm`} defaultValue="">
                                        <option value="">-- Assign Staff --</option>
                                        {eligibleStaff.map(s => <option key={s.uid} value={JSON.stringify({uid: s.uid, name: `${s.firstName} ${s.lastName}`})}>{s.firstName} {s.lastName}</option>)}
                                    </select>
                                    {slotBids.length > 0 && (
                                        <div className="mt-2 pt-2 border-t dark:border-gray-600">
                                            <h4 className="text-xs font-bold text-gray-500">BIDS ({slotBids.length})</h4>
                                            <ul className="mt-1 space-y-1">
                                                {slotBids.map(bid => (
                                                    <li key={bid.uid} className="flex justify-between items-center text-sm">
                                                        <span>{bid.name}</span>
                                                        <button type="button" onClick={() => handleAssign(slot.id, bid)} disabled={loading} className="px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600">Assign</button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )})}
                    <button type="button" onClick={addSlot} className="flex items-center text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300"><PlusIcon className="w-4 h-4 mr-1"/> Add Slot</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                 <div>
                    <label className={labelClasses}>Assigned Vehicle</label>
                    <select name="assignedVehicleId" value={formData.assignedVehicleId} onChange={handleChange} className={inputClasses}>
                        <option value="">-- None --</option>
                        {vehicles.map(v => <option key={v.id!} value={v.id!}>{v.name} ({v.registration})</option>)}
                    </select>
                </div>
                 <div>
                    <label className={labelClasses}>Assigned Kits</label>
                    <select multiple name="assignedKitIds" value={formData.assignedKitIds} onChange={handleKitSelect} className={`${inputClasses} h-24`}>
                        {kits.map(k => <option key={k.id!} value={k.id!}>{k.name}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="mt-4">
                <label className={labelClasses}>Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={inputClasses} />
            </div>
            
            <div className="flex justify-between items-center mt-6">
                <div>
                    {shift && <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"><TrashIcon className="w-5 h-5 mr-2"/> Delete</button>}
                </div>
                <div className="flex gap-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md">Cancel</button>
                    <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md flex items-center">{loading && <SpinnerIcon className="w-5 h-5 mr-2" />} Save</button>
                </div>
            </div>
        </form>
    );

    const renderStaffContent = () => {
        if (type === 'unavailability') {
             return (
                <form onSubmit={handleSubmit}>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className={labelClasses}>Start</label><input type="datetime-local" name="start" value={formData.start} onChange={handleChange} required className={inputClasses} /></div>
                        <div><label className={labelClasses}>End</label><input type="datetime-local" name="end" value={formData.end} onChange={handleChange} required className={inputClasses} /></div>
                    </div>
                    <div className="mt-4"><label className={labelClasses}>Reason (optional)</label><input type="text" name="unavailabilityReason" value={formData.unavailabilityReason} onChange={handleChange} className={inputClasses} /></div>
                     <div className="flex justify-between items-center mt-6">
                        <div>
                            {shift && <button type="button" onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"><TrashIcon className="w-5 h-5 mr-2"/> Delete</button>}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md">Cancel</button>
                            <button type="submit" disabled={loading} className="px-4 py-2 bg-ams-blue text-white rounded-md flex items-center">{loading && <SpinnerIcon className="w-5 h-5 mr-2" />} Save</button>
                        </div>
                    </div>
                </form>
            );
        }
        
        // Bidding view for shifts
        const biddableSlots = (shift?.slots || []).filter(s => !s.assignedStaff && isRoleOrHigher(currentUser.role, s.roleRequired)) || [];
        
        return (
            <div>
                 <h3 className="text-lg font-bold">{shift?.eventName}</h3>
                 <p>{shift?.start.toDate().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</p>
                 <p className="mt-2 text-gray-600 dark:text-gray-400">{shift?.location}</p>
                 {shift?.notes && <p className="mt-2 text-sm italic">"{shift?.notes}"</p>}
                 
                 <div className="mt-6 pt-4 border-t dark:border-gray-600">
                    <h4 className="font-semibold mb-2">Available Slots to Bid On</h4>
                    {biddableSlots.length > 0 ? (
                        <div className="space-y-2">
                        {biddableSlots.map(slot => {
                            const myBid = (shift?.slots.find(s => s.id === slot.id)?.bids || []).find(b => b.uid === currentUser.uid);
                            return (
                                <div key={slot.id} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{slot.roleRequired}</span>
                                    {myBid ? (
                                        <button onClick={() => handleCancelBid(slot.id)} disabled={loading} className="px-3 py-1 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400">
                                            {loading ? <SpinnerIcon className="w-4 h-4" /> : 'Withdraw Bid'}
                                        </button>
                                    ) : (
                                        <button onClick={() => handleBid(slot.id)} disabled={loading} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400">
                                            {loading ? <SpinnerIcon className="w-4 h-4" /> : 'Bid'}
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No slots available for you to bid on for this shift.</p>
                    )}
                 </div>
            </div>
        )
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} title={type === 'unavailability' ? "Remove Unavailability" : "Delete Shift"} message={type === 'unavailability' ? "Are you sure?" : "Are you sure you want to delete this shift?"} confirmText="Delete" isLoading={isDeleting}/>
            {shift && <RepeatShiftModal isOpen={isRepeatModalOpen} onClose={() => setRepeatModalOpen(false)} shift={shift} onSave={refreshShifts} />}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-ams-blue dark:text-ams-light-blue">{title}</h2>
                    {isManager && shift && (
                        <div className="flex gap-2">
                             <button onClick={() => setRepeatModalOpen(true)} title="Repeat Shift" className="p-2 text-gray-500 hover:text-ams-blue disabled:opacity-50"><RefreshIcon className="w-5 h-5"/></button>
                             <button onClick={() => {
                                // TODO: Implement duplicate
                             }} title="Duplicate Shift" className="p-2 text-gray-500 hover:text-ams-blue disabled:opacity-50"><CopyIcon className="w-5 h-5"/></button>
                        </div>
                    )}
                </div>
                {isManager ? renderManagerContent() : renderStaffContent()}
            </div>
        </div>
    );
};

export default ShiftModal;