import React, { useRef, useEffect, useState } from 'react';
import type { Injury } from '../types';
import { PencilIcon, EraserIcon, TrashIcon } from './icons';

interface InteractiveBodyMapProps {
    value: Injury[];
    onChange: (injuries: Injury[]) => void;
}

const BODY_OUTLINE_SRC = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMzUwIj48cGF0aCBkPSJNNzIgMjJDODIgMTIgMTE4IDEyIDEyOCAyMiBDMTQ1IDMyIDE0NSA2MiAxMjggNzIgQzExOCA4MiA4MiA4MiA3MiA3MiBDNTUgNjIgNTUgMzIgNzIgMjIgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYWRhZGFkIiBzdHJva2Utd2lkdGg9IjIiLz48cGF0aCBkPSJNMTEwIDc0IEwgOTAgNzQgUTkwIDg0IDg1IDg5IFE4MCA5NCA4NSA5OSBMMTE1IDk5IFEyMCA5NCAxMTUgODkgUTEyMCA4NCAxMTAgNzQgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYWRhZGFkIiBzdHJva2Utd2lkdGg9IjIiLz48cGF0aCBkPSJNNjQgMTAwIEwgMTM2IDEwMCBMMTM4IDEyMCBMMTQ4IDEyNSBMMTUyIDE4MCBMMTQ2IDI0MCBMMTQwIDMwMCBMMTMwIDMzMCBMMTE1IDMzNSBMODUgMzM1IEw3MCAzMzAgTDYwIDMwMCBMNTQgMjQwIEw0OCAxODAgTDUyIDEyNSBMNjIgMTIwIEw2NCAxMDAgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYWRhZGFkIiBzdHJva2Utd2lkdGg9IjIiLz48cGF0aCBkPSJNNjQgMTAwIEwgOTUgMjA1IEw4OCAzMzIgTTEzNiAxMDAgTDEwNSAyMDUgTDExMiAzMzIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2FkYWRhZCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+';

const colors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#000000']; // Red, Blue, Green, Purple, Black

const InteractiveBodyMap: React.FC<InteractiveBodyMapProps> = ({ value, onChange }) => {
    const [view, setView] = useState<'anterior' | 'posterior'>('anterior');
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [lineColor, setLineColor] = useState(colors[0]);
    const [lineWidth, setLineWidth] = useState(5);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [description, setDescription] = useState('');

    useEffect(() => {
        const canvas = drawingCanvasRef.current;
        const bgCanvas = bgCanvasRef.current;
        if (canvas && bgCanvas) {
            const ctx = canvas.getContext('2d');
            setContext(ctx);

            const bgCtx = bgCanvas.getContext('2d');
            const img = new Image();
            img.src = BODY_OUTLINE_SRC;
            img.onload = () => {
                bgCtx?.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
            };
        }
    }, []);

    const getCoords = (event: React.MouseEvent | React.TouchEvent): { x: number, y: number } => {
        if (!drawingCanvasRef.current) return { x: 0, y: 0 };
        const canvas = drawingCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
        const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
        if (!context) return;
        const { x, y } = getCoords(event);
        context.beginPath();
        context.moveTo(x, y);
        context.strokeStyle = tool === 'pen' ? lineColor : '#FFF';
        context.lineWidth = tool === 'pen' ? lineWidth : 20;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        setIsDrawing(true);
    };

    const draw = (event: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !context) return;
        event.preventDefault();
        const { x, y } = getCoords(event);
        context.lineTo(x, y);
        context.stroke();
    };

    const stopDrawing = () => {
        if (!context) return;
        context.closePath();
        setIsDrawing(false);
    };

    const clearCanvas = () => context?.clearRect(0, 0, drawingCanvasRef.current!.width, drawingCanvasRef.current!.height);

    const handleSaveDrawing = () => {
        if (drawingCanvasRef.current?.toDataURL() === document.createElement('canvas').toDataURL()) {
            return; // Canvas is blank
        }
        setIsModalOpen(true);
    };
    
    const handleAddInjury = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || !drawingCanvasRef.current) return;
        
        const newInjury: Injury = {
            id: Date.now().toString(),
            view,
            description,
            drawingDataUrl: drawingCanvasRef.current.toDataURL('image/png'),
        };
        onChange([...value, newInjury]);
        setIsModalOpen(false);
        setDescription('');
        clearCanvas();
    };
    
    const handleRemoveInjury = (id: string) => onChange(value.filter(i => i.id !== id));

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue mb-4">Describe Injury</h2>
                        <form onSubmit={handleAddInjury}>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., 5cm laceration, deep..." autoFocus rows={4} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                            <div className="flex justify-end gap-4 mt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-md">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-ams-blue text-white rounded-md">Save Injury</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="md:col-span-2 p-4 border dark:border-gray-700 rounded-lg flex flex-col items-center">
                <div className="flex gap-4 mb-2">
                    <button onClick={() => setView('anterior')} className={`px-4 py-2 rounded-md ${view === 'anterior' ? 'bg-ams-blue text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Anterior</button>
                    <button onClick={() => setView('posterior')} className={`px-4 py-2 rounded-md ${view === 'posterior' ? 'bg-ams-blue text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>Posterior</button>
                </div>
                <div className="relative w-full max-w-xs aspect-[200/350]">
                    <canvas ref={bgCanvasRef} width="200" height="350" className="absolute inset-0 w-full h-full" />
                    <canvas ref={drawingCanvasRef} width="200" height="350" className="absolute inset-0 w-full h-full cursor-crosshair"
                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                    />
                </div>
                <div className="w-full max-w-sm mt-4 p-2 bg-gray-100 dark:bg-gray-700 rounded-md space-y-3">
                    <div className="flex items-center justify-center gap-2">
                         <button onClick={() => setTool('pen')} className={`p-2 rounded-full ${tool === 'pen' ? 'bg-ams-light-blue text-white' : 'bg-gray-300 dark:bg-gray-600'}`}><PencilIcon className="w-5 h-5"/></button>
                         <button onClick={() => setTool('eraser')} className={`p-2 rounded-full ${tool === 'eraser' ? 'bg-ams-light-blue text-white' : 'bg-gray-300 dark:bg-gray-600'}`}><EraserIcon className="w-5 h-5"/></button>
                        {colors.map(c => <button key={c} onClick={() => setLineColor(c)} style={{ backgroundColor: c }} className={`w-6 h-6 rounded-full ring-2 ${lineColor === c ? 'ring-ams-blue dark:ring-ams-light-blue' : 'ring-transparent'}`}/>)}
                    </div>
                     <div className="flex items-center gap-2 px-2">
                        <label className="text-sm dark:text-gray-300">Size:</label>
                        <input type="range" min="2" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-full" />
                    </div>
                     <div className="flex justify-center gap-2">
                        <button onClick={clearCanvas} className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-sm rounded-md">Clear Drawing</button>
                        <button onClick={handleSaveDrawing} className="px-3 py-1 bg-ams-blue text-white text-sm font-semibold rounded-md">Save Injury</button>
                    </div>
                </div>
            </div>

            <div className="p-4 border dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold mb-2 dark:text-gray-300">Injury Log</h3>
                {value.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Draw on the figure to log an injury.</p> : (
                    <ul className="space-y-2 max-h-[450px] overflow-y-auto">
                        {value.map(injury => (
                            <li key={injury.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-2">
                                        <img src={injury.drawingDataUrl} alt={injury.description} className="w-16 h-16 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-900 object-contain"/>
                                        <div>
                                            <p className="font-bold dark:text-gray-200">{injury.description}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{injury.view} view</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveInjury(injury.id)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default InteractiveBodyMap;