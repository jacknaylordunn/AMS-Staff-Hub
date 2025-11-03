
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EprfIcon, DocsIcon, RotaIcon, PatientsIcon, EventsIcon } from '../components/icons';

const DashboardCard: React.FC<{ to: string, icon: React.ReactNode, title: string, description: string }> = ({ to, icon, title, description }) => (
    <Link to={to} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
        <div className="flex items-center">
            {icon}
            <div className="ml-4">
                <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                <p className="text-gray-600">{description}</p>
            </div>
        </div>
    </Link>
);


const Dashboard: React.FC = () => {
    const { user } = useAuth();

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome, {user?.displayName || user?.email}!</h1>
            <p className="text-gray-600 mb-8">This is your Aegis Medical Solutions Staff Hub. Access everything you need below.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <DashboardCard 
                    to="/eprf" 
                    icon={<EprfIcon className="w-12 h-12 text-ams-blue" />} 
                    title="New ePRF" 
                    description="Start a new electronic Patient Report Form." 
                />
                 <DashboardCard 
                    to="/patients" 
                    icon={<PatientsIcon className="w-12 h-12 text-ams-blue" />} 
                    title="Patient Records" 
                    description="Search and manage patient files." 
                />
                <DashboardCard 
                    to="/events" 
                    icon={<EventsIcon className="w-12 h-12 text-ams-blue" />} 
                    title="Event Logon" 
                    description="Logon to an event or shift." 
                />
                <DashboardCard 
                    to="/documents" 
                    icon={<DocsIcon className="w-12 h-12 text-ams-blue" />} 
                    title="Documents & Guidelines" 
                    description="Access SOPs, guidelines, and procedures." 
                />
                <DashboardCard 
                    to="/rota" 
                    icon={<RotaIcon className="w-12 h-12 text-ams-blue" />} 
                    title="Shift Rota" 
                    description="View your upcoming shifts and schedule." 
                />
            </div>

            <div className="mt-12 p-6 bg-white rounded-lg shadow-md">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Announcements</h3>
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700">New De-escalation Policy Updated</h4>
                    <p className="text-sm text-gray-500 mb-2">Posted on: 2024-07-28</p>
                    <p className="text-gray-600">All staff are required to read the updated De-escalation and Management of Violence/Aggression policy, now available in the documents section. Please familiarize yourself with the changes before your next shift.</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
