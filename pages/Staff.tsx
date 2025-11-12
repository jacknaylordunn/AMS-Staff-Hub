import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenToUsers, updateUserProfile, approveRoleChange, rejectRoleChange, deleteUser } from '../services/userService';
import type { User } from '../types';
import { SpinnerIcon, RefreshIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import { ALL_ROLES } from '../utils/roleHelper';
import ConfirmationModal from '../components/ConfirmationModal';

const Staff: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'pending-registration' | 'pending-role-change' | 'all'>('all');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [modalUser, setModalUser] = useState<User | null>(null);
    const [isApprovalModalOpen, setApprovalModalOpen] = useState(false);
    const [isDeclineModalOpen, setDeclineModalOpen] = useState(false);
    const [userToDecline, setUserToDecline] = useState<User | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        const unsubscribe = listenToUsers((userList) => {
            setUsers(userList);
            setLoading(false);
        });
        
        return () => unsubscribe();
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
            // No need to update local state, listener will do it.
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
            await deleteUser(userToDecline.uid);
            showToast("User registration declined and profile deleted.", "success");
        } catch (e) {
            showToast("Failed to decline user.", "error");
        } finally {
            setIsSaving(false);
            setDeclineModalOpen(false);
            setUserToDecline(null);
        }
    };

    const getRowClass = (user: User) => {
        let base = 'cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors';
        if (editingUser?.uid === user.uid) return `${base} bg-blue-50 dark:bg-blue-900/20`;
        if (user.role === 'Pending') return `${base} bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400`;
        if (user.pendingRole) return `${base} bg-orange-50 dark:bg-orange-900/30 border-l-4 border-orange-400`;
        return base;
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
                message={`Are you sure you want to decline the registration for ${userToDecline.firstName} ${userToDecline.lastName}? This will permanently delete their account and profile.`}
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
                <div className="flex-grow flex justify-end">
                    <button onClick={() => window.location.reload()} className="flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">
                        <RefreshIcon className="w-5 h-5 mr-2" /> Refresh
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
                                    <tr key={user.uid} 
                                        onClick={() => navigate(`/staff/${user.uid}`)} 
                                        className={getRowClass(user)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">{user.firstName} {user.lastName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {editingUser?.uid === user.uid ? (
                                                <select
                                                    defaultValue={user.role}
                                                    onChange={(e) => { e.stopPropagation(); handleRoleChange(user.uid, e.target.value as User['role']); }}
                                                    onClick={e => e.stopPropagation()}
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
                                            <div onClick={e => e.stopPropagation()}>
                                                {editingUser?.uid === user.uid ? (
                                                    <button onClick={() => setEditingUser(null)} className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300" disabled={isSaving}>Cancel</button>
                                                ) : user.pendingRole ? (
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleApproveRoleChange(user)} className="px-2 py-1 text-xs font-semibold text-white bg-green-500 rounded-md hover:bg-green-600" disabled={isSaving}>Approve</button>
                                                        <button onClick={() => handleRejectRoleChange(user.uid)} className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-md hover:bg-red-600" disabled={isSaving}>Reject</button>
                                                    </div>
                                                ) : user.role === 'Pending' ? (
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setEditingUser(user)} className="px-2 py-1 text-xs font-semibold text-white bg-green-500 rounded-md hover:bg-green-600" disabled={isSaving}>Approve & Assign</button>
                                                        <button onClick={() => handleDeclineUser(user)} className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-md hover:bg-red-600" disabled={isSaving}>Decline</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setEditingUser(user)} className="px-2 py-1 text-xs font-semibold text-ams-blue bg-ams-light-blue/20 rounded-md hover:bg-ams-light-blue/40 opacity-0 group-hover:opacity-100 transition-opacity" disabled={isSaving}>
                                                        Edit Role
                                                    </button>
                                                )}
                                            </div>
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