
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EprfIcon, DocsIcon, RotaIcon } from '../components/icons';

const Dashboard: React.FC = () => {
    const { user } = useAuth();

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome, {user?.displayName || user?.email}!</h1>
            <p className="text-gray-600 mb-8">This is your Aegis Medical Solutions Staff Hub. Access everything you need below.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link to="/eprf" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="flex items-center">
                        <EprfIcon className="w-12 h-12 text-ams-blue" />
                        <div className="ml-4">
                            <h2 className="text-xl font-bold text-gray-800">New ePRF</h2>
                            <p className="text-gray-600">Start a new electronic Patient Report Form.</p>
                        </div>
                    </div>
                </Link>

                <Link to="/documents" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="flex items-center">
                        <DocsIcon className="w-12 h-12 text-ams-blue" />
                        <div className="ml-4">
                            <h2 className="text-xl font-bold text-gray-800">Documents & Guidelines</h2>
                            <p className="text-gray-600">Access SOPs, guidelines, and procedures.</p>
                        </div>
                    </div>
                </Link>

                <Link to="/rota" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="flex items-center">
                        <RotaIcon className="w-12 h-12 text-ams-blue" />
                        <div className="ml-4">
                            <h2 className="text-xl font-bold text-gray-800">Shift Rota</h2>
                            <p className="text-gray-600">View your upcoming shifts and schedule.</p>
                        </div>
                    </div>
                </Link>
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
