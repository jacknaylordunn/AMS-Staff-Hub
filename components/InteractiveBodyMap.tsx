import React, { useState } from 'react';
import type { Injury } from '../types';

interface InteractiveBodyMapProps {
    value: Injury[];
    onChange: (injuries: Injury[]) => void;
}

export const InteractiveBodyMap: React.FC<InteractiveBodyMapProps> = ({ value, onChange }) => {
    const [view, setView] = useState<'anterior' | 'posterior'>('anterior');

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Injury Map</h4>
                <div>
                    <button type="button" onClick={() => setView('anterior')} className={`px-3 py-1 text-sm rounded-l-md ${view === 'anterior' ? 'bg-ams-blue text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Anterior</button>
                    <button type="button" onClick={() => setView('posterior')} className={`px-3 py-1 text-sm rounded-r-md ${view === 'posterior' ? 'bg-ams-blue text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Posterior</button>
                </div>
            </div>
            <div className="relative bg-gray-100 dark:bg-gray-700 p-4 text-center text-gray-500 rounded">
                <p>Interactive body map placeholder.</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">Interactive drawing functionality is not fully implemented.</p>
            {value.length > 0 && (
                <div className="mt-2">
                    <h5 className="font-semibold text-sm">Logged Injuries:</h5>
                    <ul className="list-disc list-inside text-sm">
                        {value.map(injury => (
                            <li key={injury.id}>{injury.description} ({injury.view})</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
