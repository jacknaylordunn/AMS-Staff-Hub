import React, { useState, useRef } from 'react';
import type { Injury } from '../types';
import { TrashIcon } from './icons';

interface InteractiveBodyMapProps {
    value: Injury[];
    onChange: (injuries: Injury[]) => void;
}

const BODY_IMAGE_ANTERIOR = 'https://i.imgur.com/L4q5T4D.png';
const BODY_IMAGE_POSTERIOR = 'https://i.imgur.com/xPOiA5d.png';

export const InteractiveBodyMap: React.FC<InteractiveBodyMapProps> = ({ value, onChange }) => {
    const [view, setView] = useState<'anterior' | 'posterior'>('anterior');
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        const description = prompt('Enter a description for this injury:');
        if (description) {
            // FIX: Generate a snapshot of the injury on the body map and store it as a data URL.
            const generateInjurySnapshot = (
                view: 'anterior' | 'posterior',
                coords: { x: number; y: number },
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
                    
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)'; // red-500/70
                    ctx.beginPath();
                    ctx.arc(markerX, markerY, 12, 0, 2 * Math.PI); // A circle with 24px diameter
                    ctx.fill();

                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('!', markerX, markerY + 1);

                    callback(canvas.toDataURL('image/png'));
                };
                img.onerror = () => {
                    console.error("Could not load body map image for snapshot.");
                    callback(""); // return empty string on error
                };
                img.src = view === 'anterior' ? BODY_IMAGE_ANTERIOR : BODY_IMAGE_POSTERIOR;
            };

            generateInjurySnapshot(view, { x, y }, (drawingDataUrl) => {
                const newInjury: Injury = {
                    id: Date.now().toString(),
                    view,
                    coords: { x, y },
                    description,
                    drawingDataUrl,
                };
                onChange([...value, newInjury]);
            });
        }
    };

    const removeInjury = (id: string) => {
        onChange(value.filter(injury => injury.id !== id));
    };
    
    const injuriesForCurrentView = value.filter(injury => injury.view === view);

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Injury Map</h4>
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
                {injuriesForCurrentView.map(injury => (
                    <div
                        key={injury.id}
                        className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 bg-red-500/70 rounded-full flex items-center justify-center text-white font-bold cursor-default"
                        style={{ left: `${injury.coords.x}%`, top: `${injury.coords.y}%` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        !
                    </div>
                ))}
            </div>

            {value.length > 0 ? (
                <div className="mt-4">
                    <h5 className="font-semibold text-sm">Logged Injuries:</h5>
                    <ul className="space-y-2 mt-2">
                        {value.map(injury => (
                            <li key={injury.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                                <div>
                                    <span className="font-semibold capitalize text-ams-blue dark:text-ams-light-blue">{injury.view}: </span>
                                    <span className="dark:text-gray-200">{injury.description}</span>
                                </div>
                                <button type="button" onClick={() => removeInjury(injury.id)} className="text-red-500 hover:text-red-700">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                 <p className="text-xs text-center text-gray-500 mt-2">Click on the diagram to add an injury marker.</p>
            )}
        </div>
    );
};