import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getUserProfile, updateUserProfile } from '../services/userService';
import type { User, ComplianceDocument } from '../types';
import { SpinnerIcon, TrashIcon, PlusIcon, DocsIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import * as firestore from 'firebase/firestore';
import ComplianceUploadModal from '../components/ComplianceUploadModal';

const DetailCard: React.FC<{ title: string, children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow ${className}`}>
        <h3 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue border-b dark:border-gray-700 pb-2 mb-4">{title}</h3>
        <div className="space-y-2 text-gray-700 dark:text-gray-300">{children}</div>
    </div>
);

const StaffDetail: React.FC = () => {
    const { userId } = useParams<{ userId: string }>();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<ComplianceDocument | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchUser = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const userProfile = await getUserProfile(userId);
            setUser(userProfile);
        } catch (error) {
            showToast("Failed to load user data.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, [userId]);
    
    const handleUploadComplete = () => {
        fetchUser(); // Refresh user data after upload
        setUploadModalOpen(false);
    }

    const handleDeleteClick = (doc: ComplianceDocument) => {
        setDocToDelete(doc);
    };

    const handleDeleteConfirm = async () => {
        if (!docToDelete || !user) return;
        setIsDeleting(true);
        try {
            const updatedDocs = user.complianceDocuments?.filter(d => d.id !== docToDelete.id) || [];
            await updateUserProfile(user.uid, { complianceDocuments: updatedDocs });
            showToast("Document deleted successfully.", "success");
            setUser(prev => prev ? ({ ...prev, complianceDocuments: updatedDocs }) : null);
        } catch(e) {
            showToast("Failed to delete document.", "error");
        } finally {
            setIsDeleting(false);
            setDocToDelete(null);
        }
    }
    
    const getExpiryColor = (expiryDate?: string): string => {
        if (!expiryDate) return 'text-gray-500';
        const today = new Date();
        const expiry = new Date(expiryDate);
        today.setHours(0,0,0,0);
        expiry.setHours(0,0,0,0);
        
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        if (expiry < today) return 'text-red-500 font-bold';
        if (expiry <= thirtyDaysFromNow) return 'text-orange-500 font-semibold';
        return 'text-green-600';
    };


    if (loading) {
        return <div className="flex justify-center items-center p-10"><SpinnerIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" /></div>;
    }

    if (!user) {
        return <div className="text-center p-10 text-xl text-gray-600 dark:text-gray-300">User not found.</div>;
    }

    return (
        <div>
            <ComplianceUploadModal 
                isOpen={isUploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                onUploadComplete={handleUploadComplete}
                userId={user.uid}
            />
            <ConfirmationModal 
                isOpen={!!docToDelete}
                onClose={() => setDocToDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Document"
                message={`Are you sure you want to delete the document "${docToDelete?.name}"?`}
                confirmText="Delete"
                isLoading={isDeleting}
            />

            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-2">{user.firstName} {user.lastName}</h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">{user.role}</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <DetailCard title="Contact Information">
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Phone:</strong> {user.phone || 'Not provided'}</p>
                    </DetailCard>
                </div>
            </div>
        </div>
    );
};

// FIX: Add default export to the component.
export default StaffDetail;