import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Kudo, User, AnonymousFeedback } from '../types';
import { getUsers } from '../services/userService';
import { getKudos, addKudo, addAnonymousFeedback } from '../services/wellbeingService';
import { SpinnerIcon, HeartIcon } from '../components/icons';
import { showToast } from '../components/Toast';

const Wellbeing: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'resources' | 'kudos' | 'feedback'>('resources');

    const TabButton: React.FC<{ tabName: typeof activeTab, label: string }> = ({ tabName, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === tabName ? 'bg-ams-blue text-white' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">Staff Wellbeing Hub</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Your space for support, recognition, and feedback.</p>

            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex space-x-4">
                    <TabButton tabName="resources" label="Resources" />
                    <TabButton tabName="kudos" label="Peer Recognition" />
                    <TabButton tabName="feedback" label="Anonymous Feedback" />
                </div>
            </div>

            <div>
                {activeTab === 'resources' && <ResourceLibrary />}
                {activeTab === 'kudos' && <KudosCorner />}
                {activeTab === 'feedback' && <AnonymousFeedbackBox />}
            </div>
        </div>
    );
};

const ResourceLibrary: React.FC = () => {
    const resources = [
        { title: 'TASC (The Ambulance Staff Charity)', description: 'The national charity dedicated to supporting the mental and physical wellbeing of ambulance staff.', link: 'https://www.theasc.org.uk/' },
        { title: 'Mind Blue Light Programme', description: 'Mental health support and resources specifically for emergency service workers.', link: 'https://www.mind.org.uk/information-support/your-stories/supporting-our-blue-light-services/' },
        { title: 'Samaritans', description: 'Confidential support for people experiencing feelings of distress or despair. Call 116 123 for free.', link: 'https://www.samaritans.org/' },
        { title: 'NHS Urgent Mental Health Helpline', description: '24/7 support for people in a mental health crisis. Find your local helpline via the NHS website.', link: 'https://www.nhs.uk/service-search/mental-health/find-an-urgent-mental-health-helpline' },
    ];
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {resources.map(res => (
                <a key={res.title} href={res.link} target="_blank" rel="noopener noreferrer" className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
                    <h3 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue">{res.title}</h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">{res.description}</p>
                </a>
            ))}
        </div>
    );
};

const KudosCorner: React.FC = () => {
    const { user } = useAuth();
    const [kudos, setKudos] = useState<Kudo[]>([]);
    const [staff, setStaff] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form state
    const [recipientUid, setRecipientUid] = useState('');
    const [message, setMessage] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [kudosList, staffList] = await Promise.all([getKudos(), getUsers()]);
            setKudos(kudosList);
            // Filter out the current user from the list of recipients
            setStaff(staffList.filter(s => s.uid !== user?.uid));
        } catch (error) {
            showToast("Could not load data for kudos.", "error");
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipientUid || !message.trim() || !user) return;
        
        setIsSubmitting(true);
        const recipient = staff.find(s => s.uid === recipientUid);
        if (!recipient) {
            showToast("Selected recipient not found.", "error");
            setIsSubmitting(false);
            return;
        }

        try {
            await addKudo({
                to: { uid: recipient.uid, name: `${recipient.firstName} ${recipient.lastName}`.trim() },
                from: { uid: user.uid, name: `${user.firstName} ${user.lastName}`.trim() },
                message,
            });
            showToast("Kudos sent!", "success");
            setMessage('');
            setRecipientUid('');
            fetchData(); // Refresh the feed
        } catch (error) {
            showToast("Failed to send kudos.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Send Kudos</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
                            <select value={recipientUid} onChange={e => setRecipientUid(e.target.value)} required className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                <option value="">Select a colleague...</option>
                                {staff.map(s => <option key={s.uid} value={s.uid}>{s.firstName} {s.lastName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} required className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="Say something great..."/>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full px-4 py-2 bg-ams-light-blue text-white font-semibold rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center justify-center">
                            {isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2" />} Send
                        </button>
                    </form>
                </div>
            </div>
            <div className="lg:col-span-2">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Recent Kudos</h3>
                {loading ? <SpinnerIcon className="w-8 h-8 text-ams-blue" /> : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        {kudos.map(kudo => (
                            <div key={kudo.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                                <p className="text-gray-800 dark:text-gray-200">"{kudo.message}"</p>
                                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    - <strong>{kudo.from.name}</strong> to <strong>{kudo.to.name}</strong> <HeartIcon className="w-4 h-4 text-red-500"/>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const AnonymousFeedbackBox: React.FC = () => {
    const [category, setCategory] = useState<AnonymousFeedback['category']>('Suggestion');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        try {
            await addAnonymousFeedback(message, category);
            showToast("Your feedback has been submitted anonymously. Thank you!", "success");
            setMessage('');
        } catch (error) {
            showToast("Failed to submit feedback.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="max-w-2xl mx-auto">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                 <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Anonymous Feedback "Vent Box"</h3>
                 <div className="p-4 mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">
                    <p className="font-bold">Important:</p>
                    <p className="text-sm">This form is completely anonymous. No identifying information is collected or stored. Your feedback is sent directly to senior leadership for review.</p>
                 </div>
                 <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value as any)} className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                            <option>Suggestion</option>
                            <option>Concern</option>
                            <option>Positive</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} required className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="Please be constructive and professional..."/>
                     </div>
                      <button type="submit" disabled={isSubmitting} className="w-full px-4 py-2 bg-ams-blue text-white font-semibold rounded-md hover:bg-opacity-90 disabled:bg-gray-400 flex items-center justify-center">
                         {isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2" />} Submit Anonymously
                     </button>
                 </form>
             </div>
        </div>
    );
};

export default Wellbeing;