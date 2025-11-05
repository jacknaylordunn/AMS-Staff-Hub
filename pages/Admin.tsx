import React, { useState, useEffect, useMemo } from 'react';
import { getUsers, updateUserProfile } from '../services/userService';
import { getAnonymousFeedback } from '../services/wellbeingService';
import type { User, AnonymousFeedback } from '../types';
import { SpinnerIcon } from '../components/icons';
import { showToast } from '../components/Toast';

const Admin: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users');
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Admin Panel</h1>
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('users')} className={`${activeTab === 'users' ? 'border-ams-light-blue text-ams-blue' : 'border-transparent text-gray-500 hover:text-gray-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        User Management
                    </button>
                    <button onClick={() => setActiveTab('feedback')} className={`${activeTab === 'feedback' ? 'border-ams-light-blue text-ams-blue' : 'border-transparent text-gray-500 hover:text-gray-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Anonymous Feedback
                    </button>
                </nav>
            </div>
            
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'feedback' && <FeedbackViewer />}
        </div>
    );
};

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const userList = await getUsers();
            setUsers(userList);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            showToast("Could not load user data.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        return users
            .filter(user => {
                if (filter === 'pending') return user.role === 'Pending';
                return true;
            })
            .filter(user =>
                `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [users, searchTerm, filter]);

    const handleRoleChange = async (userId: string, newRole: User['role']) => {
        if (!newRole) return;
        setIsSaving(true);
        try {
            await updateUserProfile(userId, { role: newRole });
            showToast("User role updated successfully.", "success");
            setUsers(prevUsers => prevUsers.map(u => u.uid === userId ? { ...u, role: newRole } : u));
            setEditingUser(null);
        } catch (error) {
            console.error("Failed to update role:", error);
            showToast("Failed to update user role.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const roles: User['role'][] = ['Pending', 'First Aider', 'FREC3', 'FREC4/ECA', 'FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Welfare', 'Admin', 'Manager'];
    const pendingCount = useMemo(() => users.filter(u => u.role === 'Pending').length, [users]);

    return (
        <div>
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/2 px-4 py-2 border rounded-md focus:ring-ams-light-blue focus:border-ams-light-blue dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
                 <div className="flex items-center space-x-2">
                    <button onClick={() => setFilter('pending')} className={`px-3 py-1 text-sm font-medium rounded-full ${filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                        Pending ({pendingCount})
                    </button>
                    <button onClick={() => setFilter('all')} className={`px-3 py-1 text-sm font-medium rounded-full ${filter === 'all' ? 'bg-ams-blue text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                        All Users
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                {loading ? (
                    <div className="flex justify-center items-center p-10">
                        <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Joined</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredUsers.map(user => (
                                    <tr key={user.uid} className={editingUser?.uid === user.uid ? 'bg-blue-50 dark:bg-gray-700/50' : user.role === 'Pending' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">{user.firstName} {user.lastName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {editingUser?.uid === user.uid ? (
                                                <select
                                                    defaultValue={user.role}
                                                    onChange={(e) => handleRoleChange(user.uid, e.target.value as User['role'])}
                                                    className="p-1 border rounded-md dark:bg-gray-600 dark:border-gray-500"
                                                    disabled={isSaving}
                                                    autoFocus
                                                >
                                                    {roles.map(role => <option key={role} value={role}>{role}</option>)}
                                                </select>
                                            ) : (
                                                user.role === 'Pending' ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                                        Pending Approval
                                                    </span>
                                                ) : (
                                                    user.role || 'Not set'
                                                )
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {editingUser?.uid === user.uid ? (
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setEditingUser(null)} className="text-gray-500 hover:text-gray-700 disabled:opacity-50" disabled={isSaving}>Cancel</button>
                                                    {isSaving && <SpinnerIcon className="w-4 h-4" />}
                                                </div>
                                            ) : (
                                                <button onClick={() => setEditingUser(user)} className="text-ams-light-blue hover:text-ams-blue" disabled={isSaving}>Edit Role</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const FeedbackViewer: React.FC = () => {
    const [feedback, setFeedback] = useState<AnonymousFeedback[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeedback = async () => {
            setLoading(true);
            try {
                const feedbackList = await getAnonymousFeedback();
                setFeedback(feedbackList);
            } catch (error) {
                showToast("Could not load anonymous feedback.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchFeedback();
    }, []);

    const getCategoryColor = (category: AnonymousFeedback['category']) => {
        switch (category) {
            case 'Concern': return 'bg-red-100 text-red-800';
            case 'Suggestion': return 'bg-blue-100 text-blue-800';
            case 'Positive': return 'bg-green-100 text-green-800';
        }
    };
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            {loading ? <SpinnerIcon className="w-8 h-8 text-ams-blue" /> : (
                <div className="space-y-4">
                    {feedback.length === 0 ? <p>No anonymous feedback submitted yet.</p> : feedback.map(item => (
                        <div key={item.id} className="p-4 border rounded-md dark:border-gray-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getCategoryColor(item.category)}`}>{item.category}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{item.createdAt.toDate().toLocaleString()}</span>
                            </div>
                            <p className="whitespace-pre-wrap dark:text-gray-200">{item.message}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


export default Admin;