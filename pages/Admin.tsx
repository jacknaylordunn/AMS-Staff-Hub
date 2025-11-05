import React, { useState, useEffect, useMemo } from 'react';
import { getUsers, updateUserProfile } from '../services/userService';
import type { User } from '../types';
import { SpinnerIcon } from '../components/icons';
import { showToast } from '../components/Toast';

const Admin: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
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
        if (!searchTerm) return users;
        return users.filter(user =>
            `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const handleRoleChange = async (userId: string, newRole: User['role']) => {
        if (!newRole) return;
        setIsSaving(true);
        try {
            await updateUserProfile(userId, { role: newRole });
            showToast("User role updated successfully.", "success");
            // Update local state to reflect change immediately
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

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">User Management</h1>
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:ring-ams-light-blue focus:border-ams-light-blue dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
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

export default Admin;