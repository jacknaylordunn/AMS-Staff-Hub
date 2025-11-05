
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AppProvider } from './hooks/useAppContext';
import { ThemeProvider } from './hooks/useTheme';
import { OnlineStatusProvider } from './hooks/useOnlineStatus';
import { DataSyncProvider } from './hooks/useDataSync';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EPRF from './pages/EPRF';
import Documents from './pages/Documents';
import Rota from './pages/Rota';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';
import Patients from './pages/Patients';
// FIX: The component PatientDetail was not exported correctly. This is fixed in pages/PatientDetail.tsx.
import PatientDetail from './pages/PatientDetail';
import Events from './pages/Events';
import EPRFReviews from './pages/EPRFReviews';
import Assets from './pages/Assets';
import VehicleDetail from './pages/VehicleDetail';
import Reports from './pages/Reports';
import Announcements from './pages/Announcements';
import Admin from './pages/Admin';
import { signOut } from 'firebase/auth';
import { auth } from './services/firebase';


const PendingApproval: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error signing out: ', error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-ams-gray dark:bg-gray-900 text-center p-4">
            <img src="https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png" alt="AMS Logo" className="h-16 mb-8" />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Account Pending Approval</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 max-w-xl">
                Hello {user?.firstName}, your registration is complete and your account is currently awaiting approval from an administrator.
            </p>
            <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                You will be notified once your role has been assigned and your account is activated. Please check back later.
            </p>
            <button
                onClick={handleLogout}
                className="mt-8 px-6 py-3 bg-ams-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90"
            >
                Logout
            </button>
        </div>
    );
};


const AppRoutes: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-ams-blue dark:bg-gray-900">
                <div className="text-white dark:text-gray-300 text-2xl animate-pulse">Loading Aegis Hub...</div>
            </div>
        );
    }

    if (user && user.role === 'Pending') {
        return (
            <Routes>
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/pending-approval" replace />} />
            </Routes>
        )
    }


    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/pending-approval" element={<Navigate to="/dashboard" replace />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="eprf" element={<EPRF />} />
                <Route path="documents" element={<Documents />} />
                <Route path="rota" element={<Rota />} />
                <Route path="profile" element={<Profile />} />
                <Route path="patients" element={<Patients />} />
                <Route path="patients/:patientId" element={<PatientDetail />} />
                <Route path="events" element={<Events />} />
                 <Route 
                    path="reviews" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <EPRFReviews />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="assets" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <Assets />
                        </ProtectedRoute>
                    } 
                />
                 <Route 
                    path="assets/vehicle/:vehicleId" 
                    element={
                        <ProtectedRoute>
                            <VehicleDetail />
                        </ProtectedRoute>
                    } 
                />
                 <Route 
                    path="reports" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <Reports />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="announcements" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <Announcements />
                        </ProtectedRoute>
                    } 
                />
                 <Route 
                    path="admin" 
                    element={
                        <ProtectedRoute roles={['Admin']}>
                            <Admin />
                        </ProtectedRoute>
                    } 
                />
            </Route>
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <AuthProvider>
                <AppProvider>
                    <OnlineStatusProvider>
                        <DataSyncProvider>
                            <HashRouter>
                                <AppRoutes />
                            </HashRouter>
                        </DataSyncProvider>
                    </OnlineStatusProvider>
                </AppProvider>
            </AuthProvider>
        </ThemeProvider>
    );
};

export default App;