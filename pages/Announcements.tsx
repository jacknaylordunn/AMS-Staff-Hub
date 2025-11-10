import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAnnouncements, sendAnnouncement, deleteAnnouncement, AnnouncementTarget } from '../services/announcementService';
import { getEvents } from '../services/eventService';
import type { Announcement, EventLog } from '../types';
import { SpinnerIcon, MegaphoneIcon, TrashIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { ALL_ROLES } from '../utils/roleHelper';

const Announcements: React.FC = () => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // New state for targeting
    const [targetType, setTargetType] = useState<'all' | 'roles' | 'event'>('all');
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [events, setEvents] = useState<EventLog[]>([]);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const announcements = await getAnnouncements();
            setHistory(announcements);
        } catch (error) {
            console.error("Failed to fetch announcement history:", error);
            showToast("Could not load past announcements.", "error");
        } finally {
            setHistoryLoading(false);
        }
    };
    
    useEffect(() => {
        fetchHistory();
        getEvents().then(setEvents); // Fetch events for the dropdown
    }, []);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !user) return;
        setLoading(true);

        let target: AnnouncementTarget;

        if (targetType === 'roles') {
            if (selectedRoles.length === 0) {
                showToast("Please select at least one role.", "error");
                setLoading(false);
                return;
            }
            target = { type: 'roles', roles: selectedRoles };
        } else if (targetType === 'event') {
            if (!selectedEventId) {
                showToast("Please select an event.", "error");
                setLoading(false);
                return;
            }
            target = { type: 'event', eventId: selectedEventId };
        } else {
            target = { type: 'all' };
        }

        try {
            await sendAnnouncement(message, target);
            showToast("Announcement sent.", "success");
            setMessage('');
            fetchHistory(); // Refresh history
        } catch (error) {
            console.error("Failed to send announcement:", error);
            showToast("Failed to send announcement.", "error");
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteConfirm = async () => {
        if (!announcementToDelete) return;
        setIsDeleting(true);
        try {
            await deleteAnnouncement(announcementToDelete.id!);
            showToast("Announcement deleted.", "success");
            setHistory(prev => prev.filter(a => a.id !== announcementToDelete.id));
        } catch (error) {
            showToast("Failed to delete announcement.", "error");
        } finally {
            setIsDeleting(false);
            setAnnouncementToDelete(null);
        }
    };
    
    const handleRoleChange = (role: string) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    return (
        <div>
            <ConfirmationModal
                isOpen={!!announcementToDelete}
                onClose={() => setAnnouncementToDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Announcement"
                message="Are you sure you want to permanently delete this announcement? This action cannot be undone."
                confirmText="Delete"
                isLoading={isDeleting}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                            <MegaphoneIcon className="w-6 h-6 mr-3 text-ams-blue dark:text-ams-light-blue" />
                            Send Announcement
                        </h2>
                        <form onSubmit={handleSend}>
                             <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Send To</label>
                                <select onChange={(e) => setTargetType(e.target.value as any)} value={targetType} className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                    <option value="all">All Staff</option>
                                    <option value="roles">Specific Roles</option>
                                    <option value="event">Staff at an Event</option>
                                </select>
                            </div>

                            {targetType === 'roles' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Roles</label>
                                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 border rounded-md max-h-48 overflow-y-auto dark:border-gray-600">
                                        {ALL_ROLES.filter(r => r !== 'Pending').map(role => (
                                            <label key={role} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                                <input type="checkbox" checked={selectedRoles.includes(role!)} onChange={() => handleRoleChange(role!)} className="h-4 w-4 rounded border-gray-300 text-ams-light-blue focus:ring-ams-light-blue" />
                                                <span className="text-sm dark:text-gray-300">{role}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {targetType === 'event' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event</label>
                                    <select onChange={(e) => setSelectedEventId(e.target.value)} value={selectedEventId} className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                        <option value="">Select an event...</option>
                                        {events.filter(e => e.status !== 'Completed').map(event => (
                                            <option key={event.id} value={event.id}>{event.name} ({event.date})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={6}
                                placeholder="Enter your message here..."
                                className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-ams-light-blue focus:border-ams-light-blue"
                                required
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This message will be sent as a notification to the selected staff members.</p>
                            <button
                                type="submit"
                                disabled={loading || !message.trim()}
                                className="w-full mt-4 px-4 py-3 bg-ams-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center justify-center"
                            >
                                {loading && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                                {loading ? 'Sending...' : 'Broadcast to Staff'}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
                            Announcement History
                        </h2>
                        {historyLoading ? (
                            <div className="flex justify-center items-center p-10">
                                <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
                            </div>
                        ) : history.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400">No announcements have been sent.</p>
                        ) : (
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                                {history.map(item => (
                                    <div key={item.id} className="relative group p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-ams-light-blue">
                                        <button
                                            onClick={() => setAnnouncementToDelete(item)}
                                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete announcement"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{item.message}</p>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t dark:border-gray-600">
                                            Sent by {item.sentBy.name} on {item.createdAt.toDate().toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Announcements;