
import React, { useState } from 'react';
import { functions } from '../services/firebase';
import { SpinnerIcon, SparklesIcon, QuestionMarkCircleIcon } from './icons';
import { showToast } from './Toast';

interface GuidelineAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GuidelineAssistantModal: React.FC<GuidelineAssistantModalProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    const askClinicalAssistant = functions.httpsCallable('askClinicalAssistant');


    const handleQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setResponse('');
        setShowHelp(false); // Hide help when a new query is made

        try {
            const result = await askClinicalAssistant({ query });
            setResponse((result.data as { response: string }).response);
        } catch (err: any) {
            console.error("Cloud function error:", err);
            let errorMessage = "Sorry, I couldn't fetch the information. Please check your connection or contact an administrator.";
            if (err.message.includes('API key not valid')) {
                errorMessage = "The AI assistant is not configured correctly. Please contact an administrator.";
            }
            setError(errorMessage);
            showToast("Error communicating with AI assistant.", "error");
        } finally {
            setLoading(false);
        }
    };
    
    const renderHelpContent = () => (
        <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4>About the Guideline Assistant</h4>
            <p>This is an AI-powered tool to help you quickly recall information from UK clinical guidelines like JRCALC.</p>
            <p className="font-bold">IMPORTANT: This is a support tool, not a replacement for clinical judgment. All information must be verified before being applied to patient care.</p>
            <p>Do not enter any Patient Identifiable Information (PII) into the assistant. This feature is powered by Google Gemini.</p>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start pt-16 sm:pt-24 modal-overlay" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col modal-content" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6"/>
                        Clinical Guideline Assistant
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-400 hover:text-ams-blue dark:hover:text-ams-light-blue">
                            <QuestionMarkCircleIcon className="w-6 h-6" />
                        </button>
                        <button onClick={onClose} className="text-2xl font-bold">&times;</button>
                    </div>
                </header>
                
                <div className="p-6 flex-grow overflow-y-auto">
                    {showHelp && renderHelpContent()}
                    {loading && (
                        <div className="flex flex-col items-center justify-center text-center">
                            <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
                            <p className="mt-2 text-gray-600 dark:text-gray-300">Consulting guidelines...</p>
                        </div>
                    )}
                    {error && <p className="text-red-500">{error}</p>}
                    {response && (
                        <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                            <p>{response}</p>
                        </div>
                    )}
                    {!loading && !response && !error && !showHelp && (
                        <div className="text-center text-gray-500 dark:text-gray-400">
                            <p>Ask a question about a clinical guideline, e.g., "JRCALC guidelines for anaphylaxis".</p>
                            <p className="text-xs mt-2">This is an AI assistant and may produce inaccurate information. All information must be clinically verified.</p>
                        </div>
                    )}
                </div>

                <footer className="p-4 border-t dark:border-gray-700">
                    <form onSubmit={handleQuery} className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Ask a clinical question..."
                            className="flex-grow w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
                            disabled={loading}
                        />
                        <button type="submit" disabled={loading || !query.trim()} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400">
                            Ask
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
};

export default GuidelineAssistantModal;