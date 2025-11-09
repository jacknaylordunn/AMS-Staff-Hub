import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { EPRFForm } from '../types';
import { getPendingEPRFs } from '../services/eprfService';
import { SpinnerIcon } from '../components/icons';

const EPRFReviews: React.FC = () => {
    const [reviews, setReviews] = useState<EPRFForm[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = ReactRouterDOM.useNavigate();

    useEffect(() => {
        const fetchReviews = async () => {
            setLoading(true);
            try {
                const pending = await getPendingEPRFs();
                setReviews(pending);
            } catch (error) {
                console.error("Failed to fetch pending reviews:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">ePRFs Pending Review</h1>
            
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                 {loading ? (
                    <div className="flex justify-center items-center p-10">
                        <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
                        <span className="ml-3 text-gray-600 dark:text-gray-300">Loading Reviews...</span>
                    </div>
                 ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date & Time</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Patient Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Complaint</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Crew</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {reviews.map(eprf => (
                                    <tr key={eprf.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-gray-200">{eprf.incidentDate} {eprf.incidentTime}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{eprf.patientName}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-gray-300 truncate max-w-xs">{eprf.presentingComplaint}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-gray-300">{eprf.createdBy.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button onClick={() => navigate(`/patients/${eprf.patientId}?eprfId=${eprf.id}`)} className="text-ams-light-blue hover:text-ams-blue">
                                                View & Approve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 )}
                 {!loading && reviews.length === 0 && (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                        No ePRFs are currently pending review.
                    </div>
                )}
            </div>
        </div>
    );
};

export default EPRFReviews;
