
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AppProvider } from './hooks/useAppContext';
import { ThemeProvider } from './hooks/useTheme';
import { OnlineStatusProvider } from './hooks/useOnlineStatus';
import { DataSyncProvider } from './hooks/useDataSync';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { EPRF } from './pages/EPRF';
import Documents from './pages/Documents';
import Rota from './pages/Rota';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import TimeClock from './pages/TimeClock';
import EPRFReviews from './pages/EPRFReviews';
import Inventory from './pages/Inventory';
import VehicleDetail from './pages/VehicleDetail';
import Reports from './pages/Reports';
import Announcements from './pages/Announcements';
import Admin from './pages/Admin';
import CPD from './pages/CPD';
import MajorIncidents from './pages/MajorIncidents';
import MajorIncidentDashboard from './pages/MajorIncidentDashboard';
import KitDetail from './pages/KitDetail';
import ControlledDrugs from './pages/ControlledDrugs';
import Wellbeing from './pages/Wellbeing';
import Quality from './pages/Quality';
import Staff from './pages/Staff';
import StaffDetail from './pages/StaffDetail';
import StaffAnalytics from './pages/StaffAnalytics';
import PrintAsset from './pages/PrintAsset';
import EventBrief from './pages/EventBrief';
import LiveAssetDashboard from './pages/LiveAssetDashboard';
import { auth, messaging } from './services/firebase';
import { showToast } from './components/Toast';
import { SpinnerIcon } from './components/icons';
import EmailVerification from './components/EmailVerification';


const PendingApproval: React.FC = () => {
    const { user } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const handleLogout = async () => {
        try {
            await auth.signOut();
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
    const { user, loading, isEmailVerified } = useAuth();
    const location = ReactRouterDOM.useLocation();

    useEffect(() => {
        if (user && messaging && Notification.permission === 'granted') {
            // This listener handles messages received while the app is in the foreground.
            const unsubscribe = messaging.onMessage((payload) => {
                console.log('Foreground message received.', payload);
                if (payload.notification) {
                     showToast(
                        `${payload.notification.title}: ${payload.notification.body}`,
                        'info'
                    );
                }
            });
            return unsubscribe;
        }
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-ams-blue dark:bg-gray-900">
                <div className="text-white dark:text-gray-300 text-2xl animate-pulse">Loading Aegis Hub...</div>
            </div>
        );
    }

    // If user is logged in, don't let them see the login page.
    if (user && location.pathname === '/login') {
        return <ReactRouterDOM.Navigate to="/dashboard" replace />;
    }

    if (user && !isEmailVerified) {
        return (
            <ReactRouterDOM.Routes>
                <ReactRouterDOM.Route path="/login" element={<Login />} />
                <ReactRouterDOM.Route path="*" element={<EmailVerification />} />
            </ReactRouterDOM.Routes>
        );
    }
    
    if (user && user.role === 'Pending') {
        return (
            <ReactRouterDOM.Routes>
                <ReactRouterDOM.Route path="/pending-approval" element={<PendingApproval />} />
                <ReactRouterDOM.Route path="/login" element={<Login />} />
                <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to="/pending-approval" replace />} />
            </ReactRouterDOM.Routes>
        )
    }


    return (
        <ReactRouterDOM.Routes>
            <ReactRouterDOM.Route path="/login" element={<Login />} />
            <ReactRouterDOM.Route path="/pending-approval" element={<ReactRouterDOM.Navigate to="/dashboard" replace />} />
            <ReactRouterDOM.Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <ReactRouterDOM.Route index element={<ReactRouterDOM.Navigate to="/dashboard" replace />} />
                <ReactRouterDOM.Route path="dashboard" element={<Dashboard />} />
                <ReactRouterDOM.Route path="eprf" element={<EPRF />} />
                <ReactRouterDOM.Route path="documents" element={<Documents />} />
                <ReactRouterDOM.Route path="rota" element={<Rota />} />
                <ReactRouterDOM.Route path="cpd" element={<CPD />} />
                <ReactRouterDOM.Route path="wellbeing" element={<Wellbeing />} />
                <ReactRouterDOM.Route path="profile" element={<Profile />} />
                <ReactRouterDOM.Route path="patients" element={<Patients />} />
                <ReactRouterDOM.Route path="patients/:patientId" element={<PatientDetail />} />
                <ReactRouterDOM.Route path="time-clock" element={<TimeClock />} />
                <ReactRouterDOM.Route path="brief/:shiftId" element={<EventBrief />} />
                 <ReactRouterDOM.Route 
                    path="reviews" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <EPRFReviews />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="staff" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <Staff />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="staff/:userId" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <StaffDetail />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="staff-analytics" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <StaffAnalytics />
                        </ProtectedRoute>
                    } 
                />
                <ReactRouterDOM.Route 
                    path="inventory" 
                    element={<Inventory />} 
                />
                 <ReactRouterDOM.Route 
                    path="inventory/vehicle/:vehicleId" 
                    element={
                        <ProtectedRoute>
                            <VehicleDetail />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="inventory/kit/:kitId" 
                    element={
                        <ProtectedRoute>
                            <KitDetail />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="live-assets" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <LiveAssetDashboard />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="reports" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <Reports />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="quality" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <Quality />
                        </ProtectedRoute>
                    } 
                />
                <ReactRouterDOM.Route 
                    path="announcements" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <Announcements />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="admin" 
                    element={
                        <ProtectedRoute roles={['Admin']}>
                            <Admin />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="major-incidents" 
                    element={
                        <ProtectedRoute roles={['Manager', 'Admin']}>
                            <MajorIncidents />
                        </ProtectedRoute>
                    } 
                />
                 <ReactRouterDOM.Route 
                    path="major-incidents/:incidentId" 
                    element={
                        <ProtectedRoute>
                            <MajorIncidentDashboard />
                        </ProtectedRoute>
                    } 
                />
                <ReactRouterDOM.Route 
                    path="controlled-drugs" 
                    element={
                        <ProtectedRoute roles={['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin']}>
                            <ControlledDrugs />
                        </ProtectedRoute>
                    } 
                />
            </ReactRouterDOM.Route>
            <ReactRouterDOM.Route path="/print/:assetType/:assetId" element={<PrintAsset />} />
            <ReactRouterDOM.Route path="*" element={<NotFound />} />
        </ReactRouterDOM.Routes>
    );
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <AuthProvider>
                <AppProvider>
                    <OnlineStatusProvider>
                        <DataSyncProvider>
                            <ReactRouterDOM.HashRouter>
                                <AppRoutes />
                            </ReactRouterDOM.HashRouter>
                        </DataSyncProvider>
                    </OnlineStatusProvider>
                </AppProvider>
            </AuthProvider>
        </ThemeProvider>
    );
};

export default App;