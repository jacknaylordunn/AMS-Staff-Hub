
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { auth } from '../services/firebase';
import { showToast } from './Toast';
import { SpinnerIcon } from './icons';

const EmailVerification: React.FC = () => {
    const navigate = ReactRouterDOM.useNavigate();
    const [sending, setSending] = useState(false);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            navigate('/login');
        } catch (error) {
            showToast('Error signing out.', 'error');
        }
    };

    const handleResend = async () => {
        if (auth.currentUser) {
            setSending(true);
            try {
                await auth.currentUser.sendEmailVerification();
                showToast('Verification email sent! Please check your inbox.', 'success');
            } catch (error) {
                showToast('Failed to send verification email.', 'error');
            } finally {
                setSending(false);
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-ams-gray dark:bg-gray-900 text-center p-4">
            <img src="https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png" alt="AMS Logo" className="h-16 mb-8" />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Verify Your Email</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 max-w-xl">
                A verification link has been sent to your email address. Please click the link to continue.
            </p>
            <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                Once verified, you can refresh this page or log in again.
            </p>
            <div className="flex items-center gap-4 mt-8">
                <button
                    onClick={handleResend}
                    disabled={sending}
                    className="px-6 py-3 bg-ams-light-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center justify-center"
                >
                    {sending && <SpinnerIcon className="w-5 h-5 mr-2" />}
                    Resend Email
                </button>
                <button
                    onClick={handleLogout}
                    className="px-6 py-3 bg-ams-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90"
                >
                    Logout
                </button>
            </div>
        </div>
    );
};

export default EmailVerification;