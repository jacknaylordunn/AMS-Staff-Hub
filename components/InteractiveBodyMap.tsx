import React, { useState, useRef, useEffect } from 'react';
import type { Injury } from '../types';
import { TrashIcon, PlusIcon } from './icons';

interface InteractiveBodyMapProps {
    value: Injury[];
    onChange: (injuries: Injury[]) => void;
}

const BODY_IMAGE_ANTERIOR = 'https://i.ibb.co/C03T9L7/anterior.png';
const BODY_IMAGE_POSTERIOR = 'https://i.ibb.co/pwn5G1g/posterior.png';


const InterventionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Injury, 'id' | 'view' | 'coords' | 'drawingDataUrl'>) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const [type, setType] = useState<Injury['type']>('Other');
    const [description, setDescription] = useState('');
    const [details, setDetails] = useState<Injury['details']>({});

    if (!isOpen) return null;

    const handleSave = () => {
        let finalDescription = description;
        if (type === 'IV Access') {
            finalDescription = `Status: ${details?.ivSuccess ? 'Successful' : 'Unsuccessful'}, Size: ${details?.ivSize || 'N/A'}. ${description}`;
        }
        onSave({ type, description: finalDescription, details });
        onClose();
    };
    
    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">Log Intervention</h3>
                <div className="space-y-4">
                    <select value={type} onChange={e => setType(e.target.value as Injury['type'])} className={inputClasses}>
                        <option>IV Access</option><option>IO Access</option><option>Wound</option><option>Fracture</option><option>Burn</option><option>Other</option>
                    </select>
                    
                    {type === 'IV Access' && (
                         <div className="grid grid-cols-2 gap-4 items-center">
                            <select value={details?.ivSize || ''} onChange={e => setDetails({...details, ivSize: e.target.value as any})} className={inputClasses}>
                                <option value="">-- Size --</option>
                                <option>14g</option><option>16g</option><option>18g</option><option>20g</option><option>22g</option><option>24g</option>
                            </select>
                             <div className="flex items-center">
                                <input type="checkbox" id="ivSuccess" checked={details?.ivSuccess || false} onChange={e => setDetails({...details, ivSuccess: e.target.checked})} className="h-4 w-4" />
                                <label htmlFor="ivSuccess" className="ml-2">Successful</label>
                             </div>
                        </div>
                    )}

                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add description..." rows={3} className={inputClasses}></textarea>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-ams-blue text-white rounded-md">Save</button>
                </div>
            </div>
        </div>
    );
};

export const InteractiveBodyMap: React.FC<InteractiveBodyMapProps> = ({ value, onChange }) => {
    const [view, setView] = useState<'anterior' | 'posterior'>('anterior');
    const containerRef = useRef<HTMLDivElement>(null);
    const [isModalOpen, setModalOpen] = useState(false);
    const [clickCoords, setClickCoords] = useState<{x: number, y: number} | null>(null);

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setClickCoords({x, y});
        setModalOpen(true);
    };

    const handleSaveIntervention = (data: Omit<Injury, 'id' | 'view' | 'coords' | 'drawingDataUrl'>) => {
        if (!clickCoords) return;

        const generateInjurySnapshot = (
            view: 'anterior' | 'posterior',
            coords: { x: number; y: number },
            type: Injury['type'],
            callback: (dataUrl: string) => void
        ) => {
            const canvas = document.createElement('canvas');
            const canvasWidth = 200;
            const canvasHeight = 400;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const markerX = (coords.x / 100) * canvas.width;
                const markerY = (coords.y / 100) * canvas.height;
                
                let iconText = '?';
                let color = 'rgba(107, 114, 128, 0.7)'; // gray-500
                if (type === 'IV Access' || type === 'IO Access') { iconText = 'IV'; color = 'rgba(59, 130, 246, 0.7)'; } // blue-500
                if (type === 'Wound') { iconText = 'W'; color = 'rgba(239, 68, 68, 0.7)'; } // red-500
                if (type === 'Fracture') { iconText = 'F'; color = 'rgba(249, 115, 22, 0.7)'; } // orange-500
                if (type === 'Burn') { iconText = 'B'; color = 'rgba(168, 85, 247, 0.7)'; } // purple-500
                
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(markerX, markerY, 12, 0, 2 * Math.PI);
                ctx.fill();

                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(iconText, markerX, markerY + 1);

                callback(canvas.toDataURL('image/png'));
            };
            img.src = view === 'anterior' ? BODY_IMAGE_ANTERIOR : BODY_IMAGE_POSTERIOR;
        };
        
        generateInjurySnapshot(view, clickCoords, data.type, (drawingDataUrl) => {
            const newInjury: Injury = {
                id: Date.now().toString(),
                view,
                coords: clickCoords,
                drawingDataUrl,
                ...data,
            };
            onChange([...value, newInjury]);
        });
    };

    const removeInjury = (id: string) => {
        onChange(value.filter(injury => injury.id !== id));
    };
    
    const injuriesForCurrentView = value.filter(injury => injury.view === view);

    const getMarkerIcon = (type: Injury['type']) => {
        if (type === 'IV Access' || type === 'IO Access') return { text: 'IV', color: 'bg-blue-500/80' };
        if (type === 'Wound') return { text: 'W', color: 'bg-red-500/80' };
        if (type === 'Fracture') return { text: 'F', color: 'bg-orange-500/80' };
        if (type === 'Burn') return { text: 'B', color: 'bg-purple-500/80' };
        return { text: '?', color: 'bg-gray-500/80' };
    };

    return (
        <div>
            <InterventionModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveIntervention} />

            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Intervention Map</h4>
                <div>
                    <button type="button" onClick={() => setView('anterior')} className={`px-3 py-1 text-sm rounded-l-md ${view === 'anterior' ? 'bg-ams-blue text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Anterior</button>
                    <button type="button" onClick={() => setView('posterior')} className={`px-3 py-1 text-sm rounded-r-md ${view === 'posterior' ? 'bg-ams-blue text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Posterior</button>
                </div>
            </div>
            <div
                ref={containerRef}
                onClick={handleMapClick}
                className="relative bg-gray-100 dark:bg-gray-700 rounded cursor-crosshair select-none w-full mx-auto max-w-sm aspect-[1/2]"
                style={{
                    backgroundImage: `url(${view === 'anterior' ? BODY_IMAGE_ANTERIOR : BODY_IMAGE_POSTERIOR})`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                }}
            >
                {injuriesForCurrentView.map(injury => {
                    const { text, color } = getMarkerIcon(injury.type);
                    return (
                        <div
                            key={injury.id}
                            className={`absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 ${color} rounded-full flex items-center justify-center text-white font-bold text-sm cursor-default`}
                            style={{ left: `${injury.coords.x}%`, top: `${injury.coords.y}%` }}
                            onClick={(e) => e.stopPropagation()}
                            title={`${injury.type}: ${injury.description}`}
                        >
                            {text}
                        </div>
                    );
                })}
            </div>

            {value.length > 0 ? (
                <div className="mt-4">
                    <h5 className="font-semibold text-sm">Logged Interventions:</h5>
                    <ul className="space-y-2 mt-2">
                        {value.map(injury => (
                            <li key={injury.id} className="flex justify-between items-start p-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                                <div className="flex-grow">
                                    <span className="font-semibold capitalize text-ams-blue dark:text-ams-light-blue">{injury.type} ({injury.view}): </span>
                                    <span className="dark:text-gray-200">{injury.description}</span>
                                </div>
                                <button type="button" onClick={() => removeInjury(injury.id)} className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                 <p className="text-xs text-center text-gray-500 mt-2">Click on the diagram to log an intervention.</p>
            )}
        </div>
    );
};