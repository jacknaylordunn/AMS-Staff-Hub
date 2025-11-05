import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { requestRoleChange, updateUserProfile } from '../services/userService';
import { showToast } from '../components/Toast';
import { SpinnerIcon, TrashIcon, PlusIcon, DocsIcon } from '../components/icons';
import type { User, ComplianceDocument } from '../types';
import ConfirmationModal from '../components/ConfirmationModal';
import ComplianceUploadModal from '../components/ComplianceUploadModal';

const Profile: React.FC = () => {
    const { user } = useAuth();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [role, setRole] = useState<User['role']>('First Aider');
    const [pendingRole, setPendingRole] = useState<User['role'] | undefined>(undefined);
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<ComplianceDocument | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Local state for compliance documents to avoid re-fetching user on every change
    const [complianceDocuments, setComplianceDocuments] = useState<ComplianceDocument[]>([]);


    useEffect(() => {
        if(user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setPhone(user.phone || '');
            setAddress(user.address || '');
            setRole(user.role || 'First Aider');
            setPendingRole(user.pendingRole);
            setRegistrationNumber(user.registrationNumber || '');
            setComplianceDocuments(user.complianceDocuments || []);
        }
    }, [user]);
    
    const handlePasswordReset = async () => {
        if (user && user.email) {
            try {
                await sendPasswordResetEmail(auth, user.email);
                showToast("Password reset email sent. Please check your inbox.", 'success');
            } catch (error) {
                showToast("Failed to send password reset email.", 'error');
            }
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!firstName.trim() || !lastName.trim() || !role) {
            showToast('First name, last name, and role cannot be empty.', 'error');
            return;
        }

        if (auth.currentUser && user) {
            setLoading(true);
            try {
                const newDisplayName = `${firstName} ${lastName}`.trim();
                // Update Firebase Auth profile
                if(auth.currentUser.displayName !== newDisplayName) {
                    await updateProfile(auth.currentUser, { displayName: newDisplayName });
                }
                
                // Update Firestore profile (non-role fields)
                await updateUserProfile(auth.currentUser.uid, {
                    firstName,
                    lastName,
                    registrationNumber,
                    phone,
                    address
                });

                // Handle role change request
                if (role !== user.role) {
                    await requestRoleChange(user.uid, role);
                    setPendingRole(role);
                    showToast('Profile updated. Your role change request has been sent for approval.', 'success');
                } else {
                     showToast('Profile updated successfully!', 'success');
                }

            } catch (err) {
                showToast('Failed to update profile. Please try again.', 'error');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
    };
    
     const handleUploadComplete = () => {
        // Just refetching user data will be handled by AuthProvider, we can just close modal.
        // A better approach would be to update local state if AuthProvider is slow.
        setUploadModalOpen(false);
        showToast("Please wait a moment for your document to appear.", "info");
    };

    const handleDeleteDocConfirm = async () => {
        if (!docToDelete || !user) return;
        setIsDeleting(true);
        try {
            const updatedDocs = complianceDocuments.filter(d => d.id !== docToDelete.id);
            await updateUserProfile(user.uid, { complianceDocuments: updatedDocs });
            setComplianceDocuments(updatedDocs); // Update local state immediately
            showToast("Document deleted.", "success");
        } catch (error) {
            showToast("Failed to delete document.", "error");
        } finally {
            setIsDeleting(false);
            setDocToDelete(null);
        }
    };
    
    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    if(!user) {
        return <div className="text-center p-10 dark:text-gray-300">Loading profile...</div>
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {user && <ComplianceUploadModal isOpen={isUploadModalOpen} onClose={() => setUploadModalOpen(false)} onUploadComplete={handleUploadComplete} userId={user.uid} />}
            <ConfirmationModal isOpen={!!docToDelete} onClose={() => setDocToDelete(null)} onConfirm={handleDeleteDocConfirm} title="Delete Document" message="Are you sure you want to delete this document?" confirmText="Delete" isLoading={isDeleting} />

            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Your Profile</h1>
            
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="firstName" className={labelClasses}>First Name</label>
                            <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClasses}/>
                        </div>
                         <div>
                            <label htmlFor="lastName" className={labelClasses}>Last Name</label>
                            <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClasses}/>
                        </div>
                        <div>
                             <label className={labelClasses}>Email Address</label>
                             <p className="mt-1 text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 p-2 rounded-md h-[42px] flex items-center">{user.email}</p>
                        </div>
                        <div>
                            <label htmlFor="phone" className={labelClasses}>Phone Number</label>
                            <input type="tel" id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClasses}/>
                        </div>
                         <div className="md:col-span-2">
                            <label htmlFor="address" className={labelClasses}>Address</label>
                            <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className={inputClasses}/>
                        </div>
                        <div>
                            <label htmlFor="role" className={labelClasses}>Clinical Role</label>
                             <select id="role" name="role" required value={role} onChange={(e) => setRole(e.target.value as User['role'])} className={inputClasses}>
                                <option>First Aider</option><option>FREC3</option><option>FREC4/ECA</option><option>FREC5/EMT/AAP</option><option>Paramedic</option><option>Nurse</option><option>Doctor</option><option>Welfare</option>
                            </select>
                            {pendingRole && (
                                <p className="mt-2 p-2 text-sm bg-yellow-100 text-yellow-800 rounded-md">
                                    Your request to change role to <strong>{pendingRole}</strong> is pending manager approval. Your current role is <strong>{user.role}</strong>.
                                </p>
                            )}
                        </div>
                         <div>
                            <label htmlFor="registrationNumber" className={labelClasses}>Professional Registration (e.g. HCPC)</label>
                            <input type="text" id="registrationNumber" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={inputClasses}/>
                        </div>
                    </div>
                    
                    <div className="flex justify-end">
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-ams-blue text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center">
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                            Update Profile
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Compliance Documents</h2>
                    <button onClick={() => setUploadModalOpen(true)} className="flex items-center text-sm px-3 py-1 bg-ams-blue text-white rounded-md hover:bg-opacity-90">
                        <PlusIcon className="w-4 h-4 mr-1"/> Upload Document
                    </button>
                </div>
                 <div className="space-y-3">
                    {complianceDocuments.length > 0 ? complianceDocuments.map(doc => (
                        <div key={doc.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <DocsIcon className="w-6 h-6 text-ams-blue dark:text-ams-light-blue" />
                                <div>
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-800 dark:text-gray-200 hover:underline">{doc.name}</a>
                                    <p className="text-sm text-gray-500">Expires: {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'}</p>
                                </div>
                            </div>
                            <button onClick={() => setDocToDelete(doc)} className="p-2 text-gray-400 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    )) : (
                        <p className="text-gray-500 dark:text-gray-400">No documents uploaded.</p>
                    )}
                 </div>
            </div>

             <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                 <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Account Security</h2>
                 <div className="mt-4 flex justify-between items-center">
                    <p className="text-gray-600 dark:text-gray-300">Request a password reset link to be sent to your email.</p>
                    <button onClick={handlePasswordReset} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">
                        Change Password
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default Profile;