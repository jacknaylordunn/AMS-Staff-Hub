import React, { useState, useEffect } from 'react';
import type { EventLog } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../hooks/useAppContext';
import { getEvents, createEvent, updateEvent } from '../services/firestoreService';
import { SpinnerIcon, CheckIcon, PlusIcon } from '../components/icons';
import EventModal from '../components/EventModal';
import { showToast } from '../components/Toast';

const Events: React.FC = () => {
    const { user, isManager } = useAuth();
    const { activeEvent, setActiveEvent, clearActiveEvent } = useAppContext();
    const [events, setEvents] = useState<EventLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);

    const fetchEvents = async () => {
        setLoading(true);
        const eventList = await getEvents();
        setEvents(eventList);
        setLoading(false);
    };

    useEffect(() => {
        fetchEvents();
    }, []);
    
    const handleLogon = (event: EventLog) => {
        if (activeEvent?.id === event.id) {
            clearActiveEvent();
        } else {
            setActiveEvent(event);
        }
    };
    
    const handleOpenModal = (event: EventLog | null) => {
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const handleSaveEvent = async (eventData: Omit<EventLog, 'id'>) => {
        try {
            if (selectedEvent) {
                await updateEvent(selectedEvent.id!, eventData);
                showToast("Event updated successfully.", "success");
            } else {
                await createEvent(eventData);
                showToast("Event created successfully.", "success");
            }
            fetchEvents();
        } catch (e) {
            showToast("Failed to save event.", "error");
        } finally {
            setIsModalOpen(false);
            setSelectedEvent(null);
        }
    };

    const getStatusColor = (status: EventLog['status']) => {
        switch (status) {
            case 'Active': return 'border-green-500';
            case 'Upcoming': return 'border-blue-500';
            case 'Completed': return 'border-gray-400 opacity-70';
            default: return 'border-gray-200';
        }
    };

    return (
        <div>
            {isManager && <EventModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedEvent(null); }} onSave={handleSaveEvent} event={selectedEvent} />}
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                 <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Event Logon</h1>
                 {isManager && (
                    <button onClick={() => handleOpenModal(null)} className="flex items-center px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90">
                        <PlusIcon className="w-5 h-5 mr-2" /> Create New Event
                    </button>
                )}
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-8">Select an active event to log on as crew. This will attach your user details to all ePRFs you create during this shift.</p>
            
            {loading ? (
                <div className="flex justify-center items-center p-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
                    <span className="ml-3 text-gray-600 dark:text-gray-300">Loading Events...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {events.map(event => {
                        const isCurrent = activeEvent?.id === event.id;
                        return (
                        <div key={event.id} className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col justify-between border-l-4 ${getStatusColor(event.status)}`}>
                            <div>
                                <div className="flex justify-between items-start">
                                    <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">{event.name}</h2>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${event.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>{event.status}</span>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">{event.date}</p>
                                <p className="text-gray-700 dark:text-gray-300 mt-2">{event.location}</p>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button 
                                    onClick={() => handleLogon(event)}
                                    disabled={event.status === 'Completed'}
                                    className={`w-full px-4 py-2 font-semibold text-white rounded-md flex items-center justify-center transition-colors
                                        ${isCurrent 
                                            ? 'bg-red-500 hover:bg-red-600' 
                                            : 'bg-ams-light-blue hover:bg-opacity-90'}
                                        ${event.status === 'Completed' ? 'bg-gray-400 cursor-not-allowed' : ''}`}
                                >
                                    {isCurrent && <CheckIcon className="w-5 h-5 mr-2"/>}
                                    {isCurrent ? 'Log Off' : 'Logon to Event'}
                                </button>
                                {isManager && (
                                    <button onClick={() => handleOpenModal(event)} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">Edit</button>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            )}
            {!loading && events.length === 0 && (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    No active events found.
                </div>
            )}
        </div>
    );
};

export default Events;