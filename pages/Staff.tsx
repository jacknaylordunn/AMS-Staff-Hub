import React, { useState, useEffect, useMemo } from 'react';
import { getUsers, updateUserProfile, approveRoleChange, rejectRoleChange, deleteUserProfile } from '../services/userService';
import type { User } from '../types';
import { SpinnerIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import { ALL_ROLES } from '../utils/roleHelper';
import ConfirmationModal from '../components/ConfirmationModal';

const Staff: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'pending-registration' | 'pending-role-change' | 'all'>('pending-registration');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [modalUser, setModalUser] = useState<User | null>(null);
    const [isApprovalModalOpen, setApprovalModalOpen] = useState(false);
    const [isDeclineModalOpen, setDeclineModalOpen] = useState(false);
    const [userToDecline, setUserToDecline] = useState<User | null>(null);

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
                if (filter === 'pending-registration') return user.role === 'Pending';
                if (filter === 'pending-role-change') return !!user.pendingRole;
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
        } catch (error) {
            console.error("Failed to update role:", error);
            showToast("Failed to update user role.", "error");
        } finally {
            setIsSaving(false);
            setEditingUser(null);
        }
    };

    const handleApproveRoleChange = async (user: User) => {
        if (!user.pendingRole) return;
        setModalUser(user);
        setApprovalModalOpen(true);
    };
    
    const handleConfirmApproval = async () => {
        if (!modalUser || !modalUser.pendingRole) return;
        setIsSaving(true);
        try {
            await approveRoleChange(modalUser.uid, modalUser.pendingRole);
            setUsers(prev => prev.map(u => u.uid === modalUser.uid ? { ...u, role: modalUser.pendingRole, pendingRole: undefined } : u));
            showToast("Role change approved.", "success");
        } catch (e) {
            showToast("Failed to approve role change.", "error");
        } finally {
            setIsSaving(false);
            setApprovalModalOpen(false);
            setModalUser(null);
        }
    };

    const handleRejectRoleChange = async (userId: string) => {
        setIsSaving(true);
        try {
            await rejectRoleChange(userId);
            setUsers(prev => prev.map(u => u.uid === userId ? { ...u, pendingRole: undefined } : u));
            showToast("Role change rejected.", "info");
        } catch (e) {
            showToast("Failed to reject role change.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeclineUser = (user: User) => {
        setUserToDecline(user);
        setDeclineModalOpen(true);
    };

    const handleConfirmDecline = async () => {
        if (!userToDecline) return;
        setIsSaving(true);
        try {
            await deleteUserProfile(userToDecline.uid);
            showToast("User registration declined and profile deleted.", "success");
            setUsers(prev => prev.filter(u => u.uid !== userToDecline.uid));
        } catch (e) {
            showToast("Failed to decline user.", "error");
        } finally {
            setIsSaving(false);
            setDeclineModalOpen(false);
            setUserToDecline(null);
        }
    };

    const pendingRegistrationCount = useMemo(() => users.filter(u => u.role === 'Pending').length, [users]);
    const pendingRoleChangeCount = useMemo(() => users.filter(u => !!u.pendingRole).length, [users]);

    return (
        <div>
            {modalUser && <ConfirmationModal 
                isOpen={isApprovalModalOpen}
                onClose={() => setApprovalModalOpen(false)}
                onConfirm={handleConfirmApproval}
                title="Approve Role Change"
                message={`Are you sure you want to approve the role change for ${modalUser.firstName} ${modalUser.lastName} from ${modalUser.role} to ${modalUser.pendingRole}?`}
                confirmText="Approve"
                isLoading={isSaving}
            />}
            {userToDecline && <ConfirmationModal 
                isOpen={isDeclineModalOpen}
                onClose={() => setDeclineModalOpen(false)}
                onConfirm={handleConfirmDecline}
                title="Decline Registration"
                message={`Are you sure you want to decline the registration for ${userToDecline.firstName} ${userToDecline.lastName}? This will permanently delete their profile.`}
                confirmText="Decline & Delete"
                isLoading={isSaving}
            />}
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Staff Management</h1>
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/2 px-4 py-2 border rounded-md focus:ring-ams-light-blue focus:border-ams-light-blue dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
                 <div className="flex items-center space-x-2">
                    <button onClick={() => setFilter('pending-registration')} className={`px-3 py-1 text-sm font-medium rounded-full ${filter === 'pending-registration' ? 'bg-yellow-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                        New Staff ({pendingRegistrationCount})
                    </button>
                    <button onClick={() => setFilter('pending-role-change')} className={`px-3 py-1 text-sm font-medium rounded-full ${filter === 'pending-role-change' ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                        Role Changes ({pendingRoleChangeCount})
                    </button>
                    <button onClick={() => setFilter('all')} className={`px-3 py-1 text-sm font-medium rounded-full ${filter === 'all' ? 'bg-ams-blue text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                        All Staff
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredUsers.map(user => (
                                    <tr key={user.uid} className={editingUser?.uid === user.uid ? 'bg-blue-50 dark:bg-gray-700/50' : (user.role === 'Pending' || user.pendingRole) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">{user.firstName} {user.lastName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {editingUser?.uid === user.uid ? (
                                                <select
                                                    defaultValue={user.role}
                                                    onChange={(e) => handleRoleChange(user.uid, e.target.value as User['role'])}
                                                    className="p-1 border rounded-md dark:bg-gray-600 dark:border-gray-500"
                                                    disabled={isSaving} autoFocus
                                                >
                                                    {ALL_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                                                </select>
                                            ) : user.pendingRole ? (
                                                <span className="flex items-center">{user.role} <span className="mx-2">&#8594;</span> <strong className="text-orange-600">{user.pendingRole}</strong></span>
                                            ) : ( user.role || 'Not set' )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {editingUser?.uid === user.uid ? (
                                                <button onClick={() => setEditingUser(null)} className="text-gray-500 hover:text-gray-700" disabled={isSaving}>Cancel</button>
                                            ) : user.pendingRole ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleApproveRoleChange(user)} className="text-green-600 hover:text-green-800" disabled={isSaving}>Approve</button>
                                                    <button onClick={() => handleRejectRoleChange(user.uid)} className="text-red-600 hover:text-red-800" disabled={isSaving}>Reject</button>
                                                </div>
                                            ) : user.role === 'Pending' ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => setEditingUser(user)} className="text-green-600 hover:text-green-800" disabled={isSaving}>Approve & Assign Role</button>
                                                    <button onClick={() => handleDeclineUser(user)} className="text-red-600 hover:text-red-800" disabled={isSaving}>Decline</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setEditingUser(user)} className="text-ams-light-blue hover:text-ams-blue" disabled={isSaving}>
                                                    Edit Role
                                                </button>
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

export default Staff;