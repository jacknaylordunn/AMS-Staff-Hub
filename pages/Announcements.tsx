import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAnnouncements, sendAnnouncementToAllUsers } from '../services/firestoreService';
import type { Announcement } from '../types';
import { SpinnerIcon, MegaphoneIcon } from '../components/icons';
import { showToast } from '../components/Toast';

const Announcements: React.FC = () => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);

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
    }, []);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !user) return;
        setLoading(true);
        try {
            const sender = { uid: user.uid, name: `${user.firstName} ${user.lastName}`.trim() };
            await sendAnnouncementToAllUsers(message, sender);
            showToast("Announcement sent to all users.", "success");
            setMessage('');
            fetchHistory(); // Refresh history
        } catch (error) {
            console.error("Failed to send announcement:", error);
            showToast("Failed to send announcement.", "error");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                        <MegaphoneIcon className="w-6 h-6 mr-3 text-ams-blue dark:text-ams-light-blue" />
                        Send Announcement
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        This message will be sent as a notification to all active staff members in the hub.
                    </p>
                    <form onSubmit={handleSend}>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={6}
                            placeholder="Enter your message here..."
                            className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-ams-light-blue focus:border-ams-light-blue"
                            required
                        />
                        <button
                            type="submit"
                            disabled={loading || !message.trim()}
                            className="w-full mt-4 px-4 py-3 bg-ams-blue text-white font-bold rounded-lg shadow-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center justify-center"
                        >
                            {loading && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                            {loading ? 'Sending...' : 'Broadcast to All Staff'}
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
                                <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-ams-light-blue">
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
    );
};

export default Announcements;
