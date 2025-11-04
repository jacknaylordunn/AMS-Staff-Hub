import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import PatientDetail from './pages/PatientDetail';
import Events from './pages/Events';
import EPRFReviews from './pages/EPRFReviews';
import Assets from './pages/Assets';
import VehicleDetail from './pages/VehicleDetail';
import Reports from './pages/Reports';

const AppRoutes: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-ams-blue dark:bg-gray-900">
                <div className="text-white dark:text-gray-300 text-2xl animate-pulse">Loading Aegis Hub...</div>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
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