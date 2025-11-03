
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';

const Profile: React.FC = () => {
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (auth.currentUser && displayName.trim() !== '') {
            try {
                await updateProfile(auth.currentUser, { displayName });
                setMessage('Profile updated successfully!');
            } catch (err) {
                setError('Failed to update profile. Please try again.');
                console.error(err);
            }
        } else {
            setError('Display name cannot be empty.');
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Your Profile</h1>
            <div className="bg-white p-8 rounded-lg shadow-md">
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <p className="mt-1 text-lg text-gray-600 bg-gray-100 p-2 rounded-md">{user?.email}</p>
                </div>

                <form onSubmit={handleUpdateProfile}>
                    <div className="mb-4">
                        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Display Name</label>
                        <input
                            type="text"
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm"
                            placeholder="Enter your full name"
                        />
                    </div>
                    
                    {message && <p className="text-green-600 text-sm mb-4">{message}</p>}
                    {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
                    
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="px-6 py-2 bg-ams-blue text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ams-blue"
                        >
                            Update Profile
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Profile;
