import React, { useState, useEffect } from 'react';
import { getAnnouncements } from '../services/announcementService';
import { getKudos } from '../services/wellbeingService';
import type { Announcement, Kudo, User } from '../types';
import { SpinnerIcon, MegaphoneIcon, HeartIcon } from './icons';

interface FeedItem {
    id: string;
    type: 'announcement' | 'kudo';
    timestamp: Date;
    data: Announcement | Kudo;
}

interface HubFeedProps {
    user: User;
}

const HubFeed: React.FC<HubFeedProps> = ({ user }) => {
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeedData = async () => {
            setLoading(true);
            try {
                const [announcements, allKudos] = await Promise.all([
                    getAnnouncements(),
                    getKudos()
                ]);

                const myKudos = allKudos.filter(k => k.to.uid === user.uid);

                const mappedAnnouncements: FeedItem[] = announcements.map(a => ({
                    id: `a-${a.id}`,
                    type: 'announcement',
                    timestamp: a.createdAt.toDate(),
                    data: a
                }));
                const mappedKudos: FeedItem[] = myKudos.map(k => ({
                    id: `k-${k.id}`,
                    type: 'kudo',
                    timestamp: k.createdAt.toDate(),
                    data: k
                }));

                const combined = [...mappedAnnouncements, ...mappedKudos].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                setFeedItems(combined.slice(0, 10)); // Limit to 10 most recent items

            } catch (error) {
                console.error("Failed to load hub feed:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFeedData();
    }, [user.uid]);

    const renderItem = (item: FeedItem) => {
        if (item.type === 'announcement') {
            const data = item.data as Announcement;
            return (
                <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ams-blue text-white flex items-center justify-center">
                        <MegaphoneIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            <strong>{data.sentBy.name}</strong> sent an announcement
                        </p>
                        <p className="mt-1 text-gray-700 dark:text-gray-200">{data.message}</p>
                    </div>
                </div>
            );
        }
        if (item.type === 'kudo') {
            const data = item.data as Kudo;
            return (
                 <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center">
                        <HeartIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            <strong>{data.from.name}</strong> sent you kudos!
                        </p>
                        <p className="mt-1 text-gray-700 dark:text-gray-200 italic">"{data.message}"</p>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-full">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-4">My Hub Feed</h2>
            {loading ? <div className="flex justify-center items-center h-full"><SpinnerIcon className="w-8 h-8 text-ams-blue"/></div> : (
                <div className="space-y-6">
                    {feedItems.length > 0 ? (
                        feedItems.map(item => <div key={item.id}>{renderItem(item)}</div>)
                    ) : (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">No recent activity for you.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default HubFeed;
