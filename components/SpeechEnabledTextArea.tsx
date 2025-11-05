
import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon } from './icons';

interface SpeechEnabledTextAreaProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
    className?: string;
}

// Check for browser support
// FIX: Cast window to 'any' to access vendor-prefixed or non-standard SpeechRecognition API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
}

const SpeechEnabledTextArea: React.FC<SpeechEnabledTextAreaProps> = ({ label, name, value, onChange, rows = 3, className = "md:col-span-2 lg:col-span-4" }) => {
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(!!recognition);

    const handleListen = () => {
        if (!recognition) return;

        if (isListening) {
            recognition.stop();
            setIsListening(false);
        } else {
            recognition.start();
            setIsListening(true);
        }
    };

    useEffect(() => {
        if (!recognition) return;

        // FIX: Use 'any' type for the event as SpeechRecognitionEvent is not available in default TS types.
        recognition.onresult = (event: any) => {
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            
            if(finalTranscript){
                const event_ = {
                    target: {
                        name: name,
                        value: value + (value ? ' ' : '') + finalTranscript.trim()
                    }
                } as React.ChangeEvent<HTMLTextAreaElement>;
                onChange(event_);
            }
        };

        recognition.onend = () => {
            if (isListening) {
              setIsListening(false);
            }
        };

        // FIX: Use 'any' type for the event as SpeechRecognitionErrorEvent is not available in default TS types.
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
             if (isListening) {
                setIsListening(false);
            }
        };
        
        return () => {
            if (recognition) {
                recognition.stop();
            }
        };
    }, [name, onChange, value, isListening]);
    
    const labelBaseClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    const inputBaseClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";


    return (
        <div className={className}>
            <label htmlFor={name} className={labelBaseClasses}>{label}</label>
            <div className="relative">
                <textarea id={name} name={name} value={value} onChange={onChange} rows={rows} className={inputBaseClasses} />
                {speechSupported && (
                    <button
                        type="button"
                        onClick={handleListen}
                        className={`absolute top-2 right-2 p-2 rounded-full transition-colors ${
                            isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                        title="Dictate text"
                    >
                        <MicrophoneIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default SpeechEnabledTextArea;