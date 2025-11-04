import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { getActiveDraftForUser, getShiftsForUser, getNotificationsForUser, markNotificationAsRead } from '../services/firestoreService';
import type { EPRFForm, Shift, Notification } from '../types';
import { EprfIcon, DocsIcon, RotaIcon, PatientsIcon, EventsIcon, LogoutIcon, BellIcon, TrashIcon } from '../components/icons';

const DashboardCard: React.FC<{ to: string, icon: React.ReactNode, title: string, description: string }> = ({ to, icon, title, description }) => (
    <Link to={to} className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
        <div className="flex items-center">
            {icon}
            <div className="ml-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{title}</h2>
                <p className="text-gray-600 dark:text-gray-400">{description}</p>
            </div>
        </div>
    </Link>
);

const NotificationsPanel: React.FC<{ notifications: Notification[], onDismiss: (id: string) => void }> = ({ notifications, onDismiss }) => {
    const navigate = useNavigate();

    const handleNotificationClick = (notification: Notification) => {
        if (notification.link) {
            navigate(notification.link);
        }
        onDismiss(notification.id!);
    };
    
    return (
        <div className="md:col-span-3 lg:col-span-1">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md h-full">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center"><BellIcon className="w-6 h-6 mr-2 text-ams-blue dark:text-ams-light-blue"/> My Tasks & Notifications</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? notifications.map(notif => (
                        <div key={notif.id} className="group p-3 bg-gray-50 dark:bg-gray-700 rounded-md flex justify-between items-start gap-2">
                           <div onClick={() => handleNotificationClick(notif)} className={`flex-grow ${notif.link ? 'cursor-pointer' : ''}`}>
                                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{notif.message}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notif.createdAt.toDate().toLocaleString()}</p>
                           </div>
                            <button onClick={() => onDismiss(notif.id!)} aria-label="Dismiss notification" className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No new notifications.</p>
                    )}
                </div>
            </div>
        </div>
    )
};


const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const { activeEvent, clearActiveEvent } = useAppContext();
    const [activeDraft, setActiveDraft] = useState<EPRFForm | null>(null);
    const [nextShift, setNextShift] = useState<Shift | null>(null);
    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        if (user) {
            getActiveDraftForUser(user.uid).then(draft => {
                setActiveDraft(draft);
            });
            
            const today = new Date();
            getShiftsForUser(user.uid, today.getFullYear(), today.getMonth()).then(shifts => {
                const now = new Date();
                const currentShift = shifts.find(s => now >= s.start.toDate() && now <= s.end.toDate());
                setActiveShift(currentShift || null);

                const upcomingShifts = shifts
                    .filter(s => s.start.toDate() > today && !s.isUnavailability)
                    .sort((a, b) => a.start.toMillis() - b.start.toMillis());
                
                if (upcomingShifts.length > 0) {
                    setNextShift(upcomingShifts[0]);
                }
            });

            getNotificationsForUser(user.uid).then(setNotifications);
        }
    }, [user]);
    
    const dismissNotification = async (id: string) => {
        await markNotificationAsRead(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">Welcome back, {user?.firstName || 'team member'}!</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">This is your Aegis Medical Solutions Staff Hub. Access everything you need below.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                 {activeEvent ? (
                    <div className="md:col-span-2 bg-green-100 border-l-4 border-green-500 rounded-lg shadow-md p-6 dark:bg-green-900 dark:border-green-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center">
                            <EventsIcon className="w-12 h-12 text-green-700 dark:text-green-400" />
                            <div className="ml-4">
                                <h2 className="text-xl font-bold text-green-800 dark:text-green-200">{activeShift ? 'On Duty' : 'Active Event'}</h2>
                                <p className="text-green-700 dark:text-green-300">
                                    You are currently logged on to: <strong>{activeEvent.name}</strong>
                                </p>
                                {activeShift && <p className="text-sm text-green-600 dark:text-green-400">Your shift ends at {activeShift.end.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>}
                            </div>
                        </div>
                        <button onClick={clearActiveEvent} className="flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
                            <LogoutIcon className="w-5 h-5 mr-2" /> Log Off
                        </button>
                    </div>
                 ) : nextShift && (
                     <Link to="/rota" className="block p-6 bg-blue-100 border-l-4 border-blue-500 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-2 dark:bg-blue-900 dark:border-blue-600">
                        <div className="flex items-center">
                            <RotaIcon className="w-12 h-12 text-blue-700 dark:text-blue-400" />
                            <div className="ml-4">
                                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200">Your Next Shift</h2>
                                <p className="text-blue-700 dark:text-blue-300">
                                    <strong>{nextShift.eventName}</strong> on <strong>{nextShift.start.toDate().toLocaleDateString()}</strong> at {nextShift.start.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    </Link>
                )}

                {activeDraft && (
                     <Link to="/eprf" className="block p-6 bg-yellow-100 border-l-4 border-yellow-500 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-2 dark:bg-yellow-900 dark:border-yellow-600">
                        <div className="flex items-center">
                            <EprfIcon className="w-12 h-12 text-yellow-700 dark:text-yellow-400" />
                            <div className="ml-4">
                                <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-200">Continue Active ePRF</h2>
                                <p className="text-yellow-700 dark:text-yellow-300">You have an unfinished report for {activeDraft.patientName || 'an unnamed patient'} from {activeDraft.incidentDate}.</p>
                            </div>
                        </div>
                    </Link>
                )}
               
                <DashboardCard 
                    to="/eprf" 
                    icon={<EprfIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />} 
                    title="New ePRF" 
                    description="Start a new electronic Patient Report Form." 
                />
                 <DashboardCard 
                    to="/patients" 
                    icon={<PatientsIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />} 
                    title="Patient Records" 
                    description="Search and manage patient files." 
                />
                <DashboardCard 
                    to="/documents" 
                    icon={<DocsIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />} 
                    title="Documents & Guidelines" 
                    description="Access SOPs, guidelines, and procedures." 
                />
                <DashboardCard 
                    to="/rota" 
                    icon={<RotaIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />} 
                    title="Shift Rota" 
                    description="View your upcoming shifts and schedule." 
                />
                </div>
                
                <NotificationsPanel notifications={notifications} onDismiss={dismissNotification} />
            </div>
        </div>
    );
};

export default Dashboard;