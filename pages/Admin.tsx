import React, { useState, useEffect, useMemo } from 'react';
import { getAnonymousFeedback } from '../services/wellbeingService';
import type { AnonymousFeedback } from '../types';
import { SpinnerIcon } from '../components/icons';
import { showToast } from '../components/Toast';

const Admin: React.FC = () => {
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Admin Panel</h1>
            <FeedbackViewer />
        </div>
    );
};


const FeedbackViewer: React.FC = () => {
    const [feedback, setFeedback] = useState<AnonymousFeedback[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeedback = async () => {
            setLoading(true);
            try {
                const feedbackList = await getAnonymousFeedback();
                setFeedback(feedbackList);
            } catch (error) {
                showToast("Could not load anonymous feedback.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchFeedback();
    }, []);

    const getCategoryColor = (category: AnonymousFeedback['category']) => {
        switch (category) {
            case 'Concern': return 'bg-red-100 text-red-800';
            case 'Suggestion': return 'bg-blue-100 text-blue-800';
            case 'Positive': return 'bg-green-100 text-green-800';
        }
    };
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Anonymous Feedback</h2>
            {loading ? <SpinnerIcon className="w-8 h-8 text-ams-blue" /> : (
                <div className="space-y-4">
                    {feedback.length === 0 ? <p>No anonymous feedback submitted yet.</p> : feedback.map(item => (
                        <div key={item.id} className="p-4 border rounded-md dark:border-gray-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getCategoryColor(item.category)}`}>{item.category}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{item.createdAt.toDate().toLocaleString()}</span>
                            </div>
                            <p className="whitespace-pre-wrap dark:text-gray-200">{item.message}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


export default Admin;