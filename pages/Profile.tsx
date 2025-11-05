import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { updateUserProfile } from '../services/userService';
import { showToast } from '../components/Toast';
import { SpinnerIcon } from '../components/icons';
import type { User } from '../types';

const Profile: React.FC = () => {
    const { user } = useAuth();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState<User['role']>('First Aider');
    const [registrationNumber, setRegistrationNumber] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if(user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setRole(user.role || 'First Aider');
            setRegistrationNumber(user.registrationNumber || '');
        }
    }, [user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!firstName.trim() || !lastName.trim() || !role) {
            showToast('First name, last name, and role cannot be empty.', 'error');
            return;
        }

        if (auth.currentUser) {
            setLoading(true);
            try {
                const newDisplayName = `${firstName} ${lastName}`.trim();
                // Update Firebase Auth profile
                if(auth.currentUser.displayName !== newDisplayName) {
                    await updateProfile(auth.currentUser, { displayName: newDisplayName });
                }
                
                // Update Firestore profile
                await updateUserProfile(auth.currentUser.uid, {
                    firstName,
                    lastName,
                    role: role as any,
                    registrationNumber
                });

                showToast('Profile updated successfully!', 'success');
            } catch (err) {
                showToast('Failed to update profile. Please try again.', 'error');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
    };
    
    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    if(!user) {
        return <div className="text-center p-10 dark:text-gray-300">Loading profile...</div>
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Your Profile</h1>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                <div className="mb-6">
                    <label className={labelClasses}>Email Address</label>
                    <p className="mt-1 text-lg text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 p-2 rounded-md">{user.email}</p>
                </div>

                <form onSubmit={handleUpdateProfile}>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="firstName" className={labelClasses}>First Name</label>
                            <input
                                type="text"
                                id="firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className={inputClasses}
                                placeholder="Enter your first name"
                            />
                        </div>
                         <div>
                            <label htmlFor="lastName" className={labelClasses}>Last Name</label>
                            <input
                                type="text"
                                id="lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className={inputClasses}
                                placeholder="Enter your last name"
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="role" className={labelClasses}>Clinical Role</label>
                         <select id="role" name="role" required value={role} onChange={(e) => setRole(e.target.value as User['role'])} className={inputClasses}>
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
                        <p className="text-xs text-gray-500 mt-1">Note: Role changes must be approved by an administrator.</p>
                    </div>

                     <div className="mb-4">
                        <label htmlFor="registrationNumber" className={labelClasses}>Professional Registration (e.g. HCPC, optional)</label>
                        <input
                            type="text"
                            id="registrationNumber"
                            value={registrationNumber}
                            onChange={(e) => setRegistrationNumber(e.target.value)}
                            className={inputClasses}
                            placeholder="NMC 12345"
                        />
                    </div>
                    
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-ams-blue text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ams-blue disabled:bg-gray-400 flex items-center"
                        >
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                            Update Profile
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Profile;
