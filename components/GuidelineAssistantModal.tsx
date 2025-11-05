import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { SpinnerIcon, SparklesIcon } from './icons';
import { getGeminiClient, handleGeminiError } from '../services/geminiService';

interface GuidelineAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GuidelineAssistantModal: React.FC<GuidelineAssistantModalProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setResponse('');

        const ai = await getGeminiClient();
        if (!ai) {
            setLoading(false);
            return;
        }

        try {
            const systemInstruction = "You are a clinical decision support assistant for Aegis Medical Solutions, a UK-based event medical provider. Your answers must be based on current UK clinical guidelines, primarily JRCALC. Do not provide a diagnosis or recommend specific drug dosages unless they are standard guideline advice. Your role is to provide information to trained clinicians to aid their decision-making, not to replace it. Always include a disclaimer at the end that the information is for guidance only and the clinician remains responsible for all patient care decisions.";
            
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: query,
                config: { systemInstruction },
            });
            
            setResponse(result.text);

        } catch (err) {
            handleGeminiError(err);
            setError("Sorry, I couldn't fetch the information. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start pt-16 sm:pt-24" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6"/>
                        Clinical Guideline Assistant
                    </h2>
                    <button onClick={onClose} className="text-2xl font-bold">&times;</button>
                </header>
                
                <div className="p-6 flex-grow overflow-y-auto">
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
                    {!loading && !response && !error && (
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