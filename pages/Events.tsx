
import React from 'react';
import type { EventLog } from '../types';
import { useAuth } from '../hooks/useAuth';

const mockEvents: EventLog[] = [
    { id: 'evt001', name: 'City Centre Foot Patrol', date: '2024-07-29', location: 'Downtown Core' },
    { id: 'evt002', name: 'Summer Music Festival', date: '2024-08-03', location: 'Greenfield Park' },
    { id: 'evt003', name: 'Corporate Gala', date: '2024-08-10', location: 'The Grand Hotel' },
    { id: 'evt004', name: 'Community Sporting Event', date: '2024-08-11', location: 'Eastside Stadium' },
];


const Events: React.FC = () => {
    const { user } = useAuth();
    
    const handleLogon = (eventName: string) => {
        alert(`User ${user?.displayName || user?.email} has logged on to event: ${eventName}. \n\nYour ePRFs will now be associated with this event.`);
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Event Logon</h1>
            <p className="text-gray-600 mb-8">Select an active event to log on as crew. This will attach your user details to all ePRFs you create during this shift.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mockEvents.map(event => (
                    <div key={event.id} className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-ams-blue">{event.name}</h2>
                            <p className="text-gray-500 mt-1">{event.date}</p>
                            <p className="text-gray-700 mt-2">{event.location}</p>
                        </div>
                        <div className="mt-4">
                             <button 
                                onClick={() => handleLogon(event.name)}
                                className="w-full px-4 py-2 font-semibold text-white bg-ams-light-blue rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ams-light-blue"
                            >
                                Logon to Event
                            </button>
                        </div>
                    </div>
                ))}
            </div>
             {mockEvents.length === 0 && (
                <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow-md">
                    No active events found.
                </div>
            )}
        </div>
    );
};

export default Events;
