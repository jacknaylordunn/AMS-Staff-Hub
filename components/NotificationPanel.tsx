import React from 'react';
import type { Notification } from '../types';
import { BellIcon } from './icons';

interface NotificationPanelProps {
    notifications: Notification[];
    onNotificationClick: (notification: Notification) => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ notifications, onNotificationClick }) => {
    return (
        <div>
            <div className="p-4 font-bold text-gray-800 dark:text-gray-200 border-b dark:border-gray-600">
                Notifications
            </div>
            <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <BellIcon className="w-8 h-8 mx-auto mb-2" />
                        <p>No new notifications</p>
                    </div>
                ) : (
                    <ul>
                        {notifications.map(notification => (
                            <li key={notification.id} className="border-b dark:border-gray-600 last:border-b-0">
                                <button
                                    onClick={() => onNotificationClick(notification)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600"
                                >
                                    <p className="text-sm text-gray-800 dark:text-gray-200">{notification.message}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {notification.createdAt.toDate().toLocaleDateString()}
                                    </p>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;
