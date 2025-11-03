import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getActiveDraftForUser, getShiftsForUser } from '../services/firestoreService';
import type { EPRFForm, Shift } from '../types';
import { EprfIcon, DocsIcon, RotaIcon, PatientsIcon, EventsIcon } from '../components/icons';

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


const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const [activeDraft, setActiveDraft] = useState<EPRFForm | null>(null);
    const [nextShift, setNextShift] = useState<Shift | null>(null);

    useEffect(() => {
        if (user) {
            getActiveDraftForUser(user.uid).then(draft => {
                setActiveDraft(draft);
            });
            
            const today = new Date();
            getShiftsForUser(user.uid, today.getFullYear(), today.getMonth()).then(shifts => {
                const upcomingShifts = shifts
                    .filter(s => s.start.toDate() > today)
                    .sort((a, b) => a.start.toMillis() - b.start.toMillis());
                if (upcomingShifts.length > 0) {
                    setNextShift(upcomingShifts[0]);
                }
            });
        }
    }, [user]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">Welcome, {user?.displayName || user?.email}!</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">This is your Aegis Medical Solutions Staff Hub. Access everything you need below.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {nextShift && (
                     <Link to="/rota" className="block p-6 bg-blue-100 border-l-4 border-blue-500 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-3 dark:bg-blue-900 dark:border-blue-600">
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
                     <Link to="/eprf" className="block p-6 bg-yellow-100 border-l-4 border-yellow-500 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-3 dark:bg-yellow-900 dark:border-yellow-600">
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
                    to="/events" 
                    icon={<EventsIcon className="w-12 h-12 text-ams-blue dark:text-ams-light-blue" />} 
                    title="Event Logon" 
                    description="Logon to an event or shift." 
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

            <div className="mt-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Announcements</h3>
                <div className="border-t pt-4 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">New De-escalation Policy Updated</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Posted on: 2024-07-28</p>
                    <p className="text-gray-600 dark:text-gray-400">All staff are required to read the updated De-escalation and Management of Violence/Aggression policy, now available in the documents section. Please familiarize yourself with the changes before your next shift.</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;