

import React, { useState, useEffect } from 'react';
// FIX: Use compat firestore types.
import firebase from 'firebase/compat/app';
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
        assignedVehicleIds: [] as string[],
        assignedKitIds: [] as string[],
    });

    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRepeatModalOpen, setRepeatModalOpen] = useState(false);
    
    const isManager = currentUser.role === 'Manager' || currentUser.role === 'Admin';

    useEffect(() => {
        if (!isOpen) {
            setCurrentShift(null); // Clear state when modal closes
            return;
        }

        const selectedDate = shift?.start.toDate() || date || new Date();
        const yyyyMMdd = selectedDate.toISOString().split('T')[0];

        if (shift) {
            const deepCopiedShift = JSON.parse(JSON.stringify(shift)); // Deep copy to prevent mutation
            
            // Rehydrate Timestamps which are lost during JSON serialization.
            deepCopiedShift.start = new firebase.firestore.Timestamp(deepCopiedShift.start.seconds, deepCopiedShift.start.nanoseconds);
            deepCopiedShift.end = new firebase.firestore.Timestamp(deepCopiedShift.end.seconds, deepCopiedShift.end.nanoseconds);
            deepCopiedShift.slots = (deepCopiedShift.slots || []).map((slot: any) => ({
                ...slot,
                bids: (slot.bids || []).map((bid: any) => ({
                    ...bid,
                    timestamp: new firebase.firestore.Timestamp(bid.timestamp.seconds, bid.timestamp.nanoseconds)
                }))
            }));
            setCurrentShift(deepCopiedShift);

            setFormData({
                eventName: shift.eventName,
                location: shift.location,
                start: shift.start.toDate().toISOString().slice(0, 16),
                end: shift.end.toDate().toISOString().slice(0, 16),
                notes: shift.notes || '',
                isUnavailability: shift.isUnavailability || false,
                unavailabilityReason: shift.unavailabilityReason || '',
                assignedVehicleIds: shift.assignedVehicleIds || [],
                assignedKitIds: shift.assignedKitIds || [],
            });
        } else { // New Shift/Unavailability
            const defaultStart = type === 'unavailability' ? `${yyyyMMdd}T00:00` : `${yyyyMMdd}T09:00`;
            const defaultEnd = type === 'unavailability' ? `${yyyyMMdd}T23:59` : `${yyyyMMdd}T17:00`;
            const nonClinicalRoles: Array<User['role']> = ['Admin', 'Manager', 'Pending'];
            const roleForUnavailability = (currentUser.role && !nonClinicalRoles.includes(currentUser.role))
                ? currentUser.role as ShiftSlot['roleRequired']
                : 'First Aider';

            const initialSlots: ShiftSlot[] = type === 'unavailability' ?
                [{ id: 'unavailability-slot', roleRequired: roleForUnavailability, assignedStaff: { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` }, bids: [] }] :
                [{ id: Date.now().toString(), roleRequired: 'First Aider', assignedStaff: null, bids: [] }];

            const newShiftData: Shift = {
                eventName: '',
                location: '',
                start: firebase.firestore.Timestamp.fromDate(new Date(defaultStart)),
                end: firebase.firestore.Timestamp.fromDate(new Date(defaultEnd)),
                notes: '',
                isUnavailability: type === 'unavailability',
                unavailabilityReason: '',
                assignedVehicleIds: [],
                assignedKitIds: [],
                slots: initialSlots,
                allAssignedStaffUids: type === 'unavailability' ? [currentUser.uid] : [],
                status: 'Open',
            };
            setCurrentShift(newShiftData);

            setFormData({
                eventName: newShiftData.eventName,
                location: newShiftData.location,
                start: defaultStart,
                end: defaultEnd,
                notes: newShiftData.notes,
                isUnavailability: newShiftData.isUnavailability,
                unavailabilityReason: newShiftData.unavailabilityReason,
                assignedVehicleIds: newShiftData.assignedVehicleIds || [],
                assignedKitIds: newShiftData.assignedKitIds || [],
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

    const addSlot = () => setCurrentShift(prev => prev ? ({ ...prev, slots: [...prev.slots, { id: Date.now().toString(), roleRequired: 'First Aider', assignedStaff: null, bids: [] }]}) : null);
    const removeSlot = (id: string) => setCurrentShift(prev => prev ? ({ ...prev, slots: prev.slots.filter(s => s.id !== id) }) : null);
    const handleSlotChange = (id: string, field: 'roleRequired', value: any) => {
        setCurrentShift(prev => prev ? ({ ...prev, slots: prev.slots.map(s => s.id === id ? { ...s, [field]: value } : s)}) : null);
    };
    
    const handleKitSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedIds = Array.from(e.target.selectedOptions, option => (option as HTMLOptionElement).value);
        setFormData(prev => ({...prev, assignedKitIds: selectedIds}));
    };

    const handleVehicleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedIds = Array.from(e.target.selectedOptions, option => (option as HTMLOptionElement).value);
        setFormData(prev => ({...prev, assignedVehicleIds: selectedIds}));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentShift || (type === 'shift' && currentShift.slots.length === 0)) {
            showToast("A shift must have at least one role slot.", "error");
            return;
        }
        setIsProcessing(true);
        try {
            const shiftData: Omit<Shift, 'id'> = {
                ...currentShift,
                ...formData,
                start: firebase.firestore.Timestamp.fromDate(new Date(formData.start)),
                end: firebase.firestore.Timestamp.fromDate(new Date(formData.end)),
                allAssignedStaffUids: [], // will be calculated in service
                status: 'Open', // will be calculated in service
                assignedVehicleNames: formData.assignedVehicleIds.map(id => vehicles.find(v => v.id === id)?.name || 'Unknown'),
                assignedKitNames: formData.assignedKitIds.map(id => kits.find(k => k.id === id)?.name || 'Unknown'),
            };
            await onSave(shiftData);
            onClose();
        } catch (error) {
            console.error("Failed to save shift:", error);
            showToast('Failed to save shift.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!currentShift) return;
        setIsDeleting(true);
        try {
            await onDelete(currentShift.id!);
            showToast(currentShift.isUnavailability ? "Unavailability removed." : "Shift deleted successfully.", "success");
            onClose();
        } catch (error) {
            showToast(currentShift.isUnavailability ? "Failed to remove unavailability." : "Failed to delete shift.", "error");
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
        }
    };
    
    const handleBid = async (slotId: string) => {
        if (!currentShift?.id) return;
        setIsProcessing(true);
        try {
            await bidOnShift(currentShift.id, slotId);
            showToast("You have bid on this shift.", "success");
            
            setCurrentShift(prevShift => {
                if (!prevShift) return null;
                const newSlots = prevShift.slots.map(slot => {
                    if (slot.id === slotId) {
                        return {
                            ...slot,
                            bids: [
                                ...(slot.bids || []), 
                                { 
                                    uid: currentUser.uid, 
                                    name: `${currentUser.firstName} ${currentUser.lastName}`,
                                    timestamp: firebase.firestore.Timestamp.now()
                                }
                            ]
                        };
                    }
                    return slot;
                });
                return { ...prevShift, slots: newSlots };
            });
        } catch (e: any) {
            console.error(e);
            showToast(e.message || "Failed to process bid.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelBid = async (slotId: string) => {
        if (!currentShift?.id) return;
        setIsProcessing(true);
        try {
            await cancelBidOnShift(currentShift.id, slotId);
            showToast("Bid withdrawn.", "success");

            setCurrentShift(prevShift => {
                 if (!prevShift) return null;
                 const newSlots = prevShift.slots.map(slot => {
                     if (slot.id === slotId) {
                         return {
                             ...slot,
                             bids: (slot.bids || []).filter(bid => bid.uid !== currentUser.uid)
                         };
                     }
                     return slot;
                 });
                 return { ...prevShift, slots: newSlots };
            });
        } catch (e: any) {
            console.error(e);
            showToast(e.message || "Failed to withdraw bid.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAssign = async (slotId: string, staffMember: { uid: string, name: string }) => {
        if (!currentShift?.id) return;
        setIsProcessing(true);
        try {
            await assignStaffToSlot(currentShift.id, slotId, staffMember);
            showToast(`${staffMember.name} has been assigned to the slot.`, "success");
            
            setCurrentShift(prev => {
                if (!prev) return null;
                const newSlots = prev.slots.map(s => {
                    if (s.id === slotId) {
                        return { ...s, assignedStaff: staffMember, bids: [] };
                    }
                    return s;
                });
                return { ...prev, slots: newSlots };
            });
        } catch (e: any) {
            console.error("Failed to assign staff:", e);
            showToast(e.message || "Failed to assign staff.", "error");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleUnassign = async (slotId: string) => {
        if (!currentShift?.id) return;
        setIsProcessing(true);
        try {
            await assignStaffToSlot(currentShift.id, slotId, null);
            showToast(`Slot has been unassigned.`, "success");
            
            setCurrentShift(prev => {
                if (!prev) return null;
                const newSlots = prev.slots.map(s => s.id === slotId ? { ...s, assignedStaff: null } : s);
                return { ...prev, slots: newSlots };
            });
        } catch (e: any) {
            console.error("Failed to unassign staff:", e);
            showToast(e.message || "Failed to unassign staff.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen || !currentShift) return null;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    
    const getTitle = () => {
        if (type === 'unavailability') {
            return shift ? 'Edit Unavailability' : 'Add Unavailability';
        }
        if (isManager) {
            return shift ? 'Edit Shift' : 'Create New Shift';
        }
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
                    {currentShift.slots.map((slot) => {
                        const eligibleStaff = staff.filter(s => isRoleOrHigher(s.role, slot.roleRequired) && !currentShift.slots.some(sl => sl.assignedStaff?.uid === s.uid));
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
                                    <button onClick={() => handleUnassign(slot.id)} disabled={isProcessing} className="px-2 py-0.5 text-xs bg-gray-400 text-white rounded hover:bg-gray-500">Unassign</button>
                                </div>
                            ) : (
                                <div className="mt-2">
                                    <select onChange={(e) => handleAssign(slot.id, JSON.parse(e.target.value))} className={`${inputClasses} text-sm`} defaultValue="">
                                        <option value="">-- Assign Staff --</option>
                                        {eligibleStaff.map(s => <option key={s.uid} value={JSON.stringify({uid: s.uid, name: `${s.firstName} ${s.lastName}`})}>{s.firstName} {s.lastName} ({s.role})</option>)}
                                    </select>
                                    {slot.bids.length > 0 && (
                                        <div className="mt-2 pt-2 border-t dark:border-gray-600">
                                            <h4 className="text-xs font-bold text-gray-500">BIDS ({slot.bids.length})</h4>
                                            <ul className="mt-1 space-y-1">
                                                {slot.bids.map(bid => (
                                                    <li key={bid.uid} className="flex justify-between items-center text-sm">
                                                        <span>{bid.name}</span>
                                                        <button type="button" onClick={() => handleAssign(slot.id, bid)} disabled={isProcessing} className="px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600">Assign</button>
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
                    <label className={labelClasses}>Assigned Vehicle(s)</label>
                    <select multiple name="assignedVehicleIds" value={formData.assignedVehicleIds} onChange={handleVehicleSelect} className={`${inputClasses} h-24`}>
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
                    <button type="submit" disabled={isProcessing} className="px-4 py-2 bg-ams-blue text-white rounded-md flex items-center">{isProcessing && <SpinnerIcon className="w-5 h-5 mr-2" />} Save</button>
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
                            <button type="submit" disabled={isProcessing} className="px-4 py-2 bg-ams-blue text-white rounded-md flex items-center">{isProcessing && <SpinnerIcon className="w-5 h-5 mr-2" />} Save</button>
                        </div>
                    </div>
                </form>
            );
        }
        
        const biddableSlots = (currentShift.slots || []).filter(s => !s.assignedStaff && isRoleOrHigher(currentUser.role, s.roleRequired)) || [];
        
        return (
            <div>
                 <h3 className="text-lg font-bold">{currentShift.eventName}</h3>
                 <p>{currentShift.start.toDate().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</p>
                 <p className="mt-2 text-gray-600 dark:text-gray-400">{currentShift.location}</p>
                 {currentShift.notes && <p className="mt-2 text-sm italic">"{currentShift.notes}"</p>}
                 
                 <div className="mt-6 pt-4 border-t dark:border-gray-600">
                    <h4 className="font-semibold mb-2">Available Slots to Bid On</h4>
                    {biddableSlots.length > 0 ? (
                        <div className="space-y-2">
                        {biddableSlots.map(slot => {
                            const myBid = (slot.bids || []).find(b => b.uid === currentUser.uid);
                            return (
                                <div key={slot.id} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{slot.roleRequired}</span>
                                    {myBid ? (
                                        <button onClick={() => handleCancelBid(slot.id)} disabled={isProcessing} className="px-3 py-1 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400">
                                            {isProcessing ? <SpinnerIcon className="w-4 h-4" /> : 'Withdraw Bid'}
                                        </button>
                                    ) : (
                                        <button onClick={() => handleBid(slot.id)} disabled={isProcessing} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400">
                                            {isProcessing ? <SpinnerIcon className="w-4 h-4" /> : 'Bid'}
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