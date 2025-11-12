
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { getAllDraftsForUser, getPendingEPRFs } from '../services/eprfService';
import { getShiftsForUser, getShiftsForDateRange } from '../services/rotaService';
import { getActiveIncidents } from '../services/majorIncidentService';
import { getUsers, saveFCMToken } from '../services/userService';
import { getVehicles } from '../services/assetService';
import type { EPRFForm, Shift, MajorIncident, User as AppUser, Vehicle } from '../types';
import { EprfIcon, RotaIcon, QrCodeIcon, ShieldExclamationIcon, ClockIcon, ChartIcon, PatientsIcon, AmbulanceIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import QrScannerModal from '../components/QrScannerModal';
import StaffCheckInModal from '../components/StaffCheckInModal';
import MethaneReportModal from '../components/MethaneReportModal';
import HubFeed from '../components/HubFeed';
import { messaging, VAPID_KEY } from '../services/firebase';

// New Card Components
const AtAGlanceCard: React.FC<{ icon: React.ReactNode, title: string, text: string, to: string, color: string }> = ({ icon, title, text, to, color }) => (
    <ReactRouterDOM.Link to={to} className={`block p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-8 ${color}`}>
        <div className="flex items-center">
            <div className="flex-shrink-0">{icon}</div>
            <div className="ml-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h2>
                <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{text}</p>
            </div>
        </div>
    </ReactRouterDOM.Link>
);

const ManagerKPICard: React.FC<{ icon: React.ReactNode, value: number, label: string, to: string }> = ({ icon, value, label, to }) => (
    <ReactRouterDOM.Link to={to} className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow duration-300">
        <div className="flex items-center">
            {icon}
            <div className="ml-4">
                <p className="text-3xl font-bold text-ams-blue dark:text-ams-light-blue">{value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            </div>
        </div>
    </ReactRouterDOM.Link>
);

const ActionCard: React.FC<{ to?: string, onClick?: () => void, icon: React.ReactNode, title: string, description: string, large?: boolean }> = ({ to, onClick, icon, title, description, large = false }) => {
    const content = (
        <div className={`text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center ${large ? 'h-48' : 'h-full'}`}>
            {icon}
            <h2 className={`font-bold text-gray-800 dark:text-gray-200 ${large ? 'text-2xl mt-4' : 'text-lg mt-2'}`}>{title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        </div>
    );

    return to ? <ReactRouterDOM.Link to={to}>{content}</ReactRouterDOM.Link> : <button onClick={onClick} className="w-full h-full">{content}</button>;
};

const Dashboard: React.FC = () => {
    const { user, isManager } = useAuth();
    const { activeClockIn } = useAppContext();
    const navigate = ReactRouterDOM.useNavigate();
    
    // Data State
    const [drafts, setDrafts] = useState<EPRFForm[]>([]);
    const [nextShift, setNextShift] = useState<Shift | null>(null);
    const [activeIncident, setActiveIncident] = useState<MajorIncident | null>(null);

    // Manager State
    const [pendingReviews, setPendingReviews] = useState<EPRFForm[]>([]);
    const [pendingStaff, setPendingStaff] = useState<AppUser[]>([]);
    const [vehiclesRequiringMaintenance, setVehiclesRequiringMaintenance] = useState<Vehicle[]>([]);
    const [staffOnDutyToday, setStaffOnDutyToday] = useState<number>(0);
    
    // Modals
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [isCheckInOpen, setCheckInOpen] = useState(false);
    const [isMethaneOpen, setMethaneOpen] = useState(false);
    
    // Notifications
    const [showNotifBanner, setShowNotifBanner] = useState(false);

    useEffect(() => {
        if (messaging && Notification.permission === 'default') {
            setShowNotifBanner(true);
        }
    }, []);

    useEffect(() => {
        if (user) {
            const fetchData = async () => {
                const today = new Date();
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                endOfMonth.setHours(23, 59, 59, 999);

                const promises: Promise<any>[] = [
                    getAllDraftsForUser(user.uid),
                    getActiveIncidents(),
                    isManager 
                        ? getShiftsForDateRange(startOfMonth, endOfMonth) 
                        : getShiftsForUser(user.uid, today.getFullYear(), today.getMonth()),
                ];

                if (isManager) {
                    promises.push(getPendingEPRFs(), getUsers(), getVehicles());
                }

                const results = await Promise.allSettled(promises);
                let hadError = false;

                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`Dashboard data fetch failed for promise ${index}:`, result.reason);
                        hadError = true;
                    }
                });

                if (hadError) showToast("Failed to load some dashboard data.", "error");
                
                // Process successful results
                if (results[0].status === 'fulfilled') setDrafts(results[0].value as EPRFForm[]);
                if (results[1].status === 'fulfilled') setActiveIncident((results[1].value as MajorIncident[])[0] || null);
                
                if (results[2].status === 'fulfilled') {
                    const shifts = results[2].value as Shift[];
                    
                    const myUpcomingShifts = shifts
                        .filter(s => {
                            const isMyShift = (s.allAssignedStaffUids || []).includes(user.uid);
                            return isMyShift && s.start.toDate() > today && !s.isUnavailability;
                        })
                        .sort((a, b) => a.start.toMillis() - b.start.toMillis());

                    if (myUpcomingShifts.length > 0) setNextShift(myUpcomingShifts[0]);

                    if (isManager) {
                        const now = new Date();
                        const onDutyShifts = shifts.filter(s => 
                            !s.isUnavailability &&
                            s.start.toDate() <= now &&
                            s.end.toDate() >= now
                        );
                        const onDutyStaffUids = new Set<string>();
                        onDutyShifts.forEach(s => {
                            (s.allAssignedStaffUids || []).forEach(uid => onDutyStaffUids.add(uid));
                        });
                        setStaffOnDutyToday(onDutyStaffUids.size);
                    }
                }
                
                if (isManager) {
                    if (results[3].status === 'fulfilled') setPendingReviews(results[3].value as EPRFForm[]);
                    if (results[4].status === 'fulfilled') setPendingStaff((results[4].value as AppUser[]).filter(u => u.role === 'Pending'));
                    if (results[5].status === 'fulfilled') setVehiclesRequiringMaintenance((results[5].value as Vehicle[]).filter(v => v.status === 'Maintenance Required'));
                }
            };
    
            fetchData();
        }
    }, [user, isManager]);

    const handleQrScan = (qrValue: string) => {
        if (qrValue.startsWith('aegis-vehicle-qr:')) {
            navigate(`/inventory/vehicle/${qrValue.split(':')[1]}`);
        } else if (qrValue.startsWith('aegis-kit-qr:')) {
            navigate(`/inventory/kit/${qrValue.split(':')[1]}`);
        } else {
            showToast('Not a valid Aegis QR code.', 'error');
        }
    };
    
    const handleEnableNotifications = async () => {
        if (!messaging || !user) return;
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await messaging.getToken({ vapidKey: VAPID_KEY });
                if (token) {
                    await saveFCMToken(user.uid, token);
                    showToast('Notifications enabled!', 'success');
                    setShowNotifBanner(false);
                }
            } else {
                showToast('Notification permission was denied.', 'info');
                setShowNotifBanner(false);
            }
        } catch (error) {
            console.error("Error enabling notifications", error);
            showToast('Could not enable notifications.', 'error');
        }
    };
    
    const renderAtAGlance = () => {
        if (activeIncident) {
            return <AtAGlanceCard 
                icon={<ShieldExclamationIcon className="w-12 h-12 text-red-500 animate-pulse" />}
                title="Major Incident Active"
                text={activeIncident.name}
                to={`/major-incidents/${activeIncident.id}`}
                color="border-red-500 bg-red-50 dark:bg-red-900/20"
            />;
        }
        if (activeClockIn) {
             return <AtAGlanceCard 
                icon={<RotaIcon className="w-12 h-12 text-green-500" />}
                title="Currently Clocked In"
                text={activeClockIn.shiftName}
                to={`/brief/${activeClockIn.shiftId}`}
                color="border-green-500 bg-green-50 dark:bg-green-900/20"
            />;
        }
        if (nextShift) {
             return <AtAGlanceCard 
                icon={<ClockIcon className="w-12 h-12 text-blue-500" />}
                title="Next Shift"
                text={`${nextShift.start.toDate().toLocaleDateString()} @ ${nextShift.start.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                to={`/brief/${nextShift.id}`}
                color="border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            />;
        }
        if (drafts.length > 0) {
            const plural = drafts.length > 1 ? 's' : '';
            return <AtAGlanceCard 
                icon={<EprfIcon className="w-12 h-12 text-yellow-500" />}
                title={`${drafts.length} Unfinished ePRF Draft${plural}`}
                text={`Click to continue your report${plural}.`}
                to="/eprf"
                color="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
            />;
        }
        return (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">All Clear!</h2>
                <p className="text-gray-500 dark:text-gray-400">No immediate tasks or upcoming shifts. You're up to date.</p>
            </div>
        );
    };


    return (
        <div>
            <QrScannerModal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} onScan={handleQrScan} />
            {activeIncident && user && <StaffCheckInModal isOpen={isCheckInOpen} onClose={() => setCheckInOpen(false)} incident={activeIncident} user={user} />}
            {activeIncident && user && <MethaneReportModal isOpen={isMethaneOpen} onClose={() => setMethaneOpen(false)} incident={activeIncident} user={user} />}

            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Welcome back, {user?.firstName}!</h1>
            
            {showNotifBanner && (
                <div className="bg-ams-light-blue text-white p-4 rounded-lg mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <p className="font-medium">Enable notifications to receive important alerts, like major incidents, even when the app is closed.</p>
                    <div className="flex-shrink-0">
                        <button onClick={handleEnableNotifications} className="px-4 py-2 bg-white text-ams-blue font-bold rounded-md shadow-md hover:bg-gray-200">Enable</button>
                        <button onClick={() => setShowNotifBanner(false)} className="ml-4 font-bold opacity-80 hover:opacity-100">Dismiss</button>
                    </div>
                </div>
            )}
            
            <div className="mb-8">{renderAtAGlance()}</div>
            
            {isManager && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-4">Manager Overview</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ManagerKPICard icon={<EprfIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />} value={pendingReviews.length} label="ePRF Reviews Pending" to="/reviews" />
                        <ManagerKPICard icon={<PatientsIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />} value={pendingStaff.length} label="New Staff Registrations" to="/staff" />
                        <ManagerKPICard icon={<RotaIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />} value={staffOnDutyToday} label="Staff on Duty Today" to="/rota" />
                        <ManagerKPICard icon={<AmbulanceIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />} value={vehiclesRequiringMaintenance.length} label="Vehicles Needing Check" to="/inventory" />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-2 gap-6 auto-rows-fr">
                     <ActionCard 
                        to="/eprf" 
                        icon={<EprfIcon className="w-16 h-16 text-ams-blue dark:text-ams-light-blue" />} 
                        title="New ePRF" 
                        description="Start a new Patient Report Form." 
                        large
                    />
                    <ActionCard
                        onClick={() => setScannerOpen(true)}
                        icon={<QrCodeIcon className="w-16 h-16 text-ams-blue dark:text-ams-light-blue" />}
                        title="Scan Asset"
                        description="Scan a vehicle or kit QR code."
                        large
                    />
                    <ActionCard to="/rota" icon={<RotaIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" />} title="Rota" description="View upcoming shifts." />
                    <ActionCard to="/patients" icon={<PatientsIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" />} title="Patients" description="Search patient records." />
                    {isManager && (
                         <ActionCard to="/reports" icon={<ChartIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" />} title="Reporting" description="View clinical analytics." />
                    )}
                    <ActionCard to="/inventory" icon={<AmbulanceIcon className="w-10 h-10 text-ams-blue dark:text-ams-light-blue" />} title="Inventory" description="Manage vehicles & kits." />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    {user && <HubFeed user={user} />}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
