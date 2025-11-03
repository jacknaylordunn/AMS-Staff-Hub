import React, { useState } from 'react';
import type { Injury } from '../types';
import { TrashIcon } from './icons';

interface InteractiveBodyMapProps {
    value: Injury[];
    onChange: (injuries: Injury[]) => void;
}

interface InjuryModalState {
    isOpen: boolean;
    location: string;
    locationId: string;
}

const BodyPart: React.FC<{ id: string; d: string; 'data-name': string; onClick: () => void; isInjured: boolean; }> = ({ id, d, 'data-name': dataName, onClick, isInjured }) => (
    <path
        id={id}
        d={d}
        data-name={dataName}
        onClick={onClick}
        className={`cursor-pointer transition-all duration-200 ${isInjured ? 'fill-red-500/80 stroke-red-700' : 'fill-gray-300 dark:fill-gray-600 stroke-gray-500 dark:stroke-gray-400 hover:fill-ams-light-blue/50'}`}
        strokeWidth="2"
    />
);

const InteractiveBodyMap: React.FC<InteractiveBodyMapProps> = ({ value, onChange }) => {
    const [modalState, setModalState] = useState<InjuryModalState>({ isOpen: false, location: '', locationId: '' });
    const [description, setDescription] = useState('');

    const openModal = (location: string, locationId: string) => {
        setModalState({ isOpen: true, location, locationId });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, location: '', locationId: '' });
        setDescription('');
    };

    const handleAddInjury = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;
        const newInjury: Injury = {
            id: Date.now().toString(),
            location: modalState.location,
            locationId: modalState.locationId,
            description,
        };
        onChange([...value, newInjury]);
        closeModal();
    };

    const handleRemoveInjury = (id: string) => {
        onChange(value.filter(injury => injury.id !== id));
    };

    const injuredPartIds = value.map(i => i.locationId);

    const bodyParts = {
        anterior: [
            { id: 'head-ant', name: 'Head (Anterior)', d: 'M130 50 A 30 40 0 1 1 70 50 A 30 40 0 1 1 130 50 Z' },
            { id: 'neck-ant', name: 'Neck (Anterior)', d: 'M90 90 L110 90 L110 100 L90 100 Z' },
            { id: 'chest-ant', name: 'Chest', d: 'M70 100 L130 100 L130 150 L70 150 Z' },
            { id: 'abdo-ant', name: 'Abdomen', d: 'M75 150 L125 150 L125 190 L75 190 Z' },
            { id: 'pelvis-ant', name: 'Pelvis', d: 'M70 190 L130 190 L120 210 L80 210 Z' },
            { id: 'r-arm-ant', name: 'Right Arm (Anterior)', d: 'M130 105 L150 105 L150 200 L135 200 Z' },
            { id: 'l-arm-ant', name: 'Left Arm (Anterior)', d: 'M70 105 L50 105 L50 200 L65 200 Z' },
            { id: 'r-leg-ant', name: 'Right Leg (Anterior)', d: 'M105 210 L125 210 L125 300 L110 300 Z' },
            { id: 'l-leg-ant', name: 'Left Leg (Anterior)', d: 'M95 210 L75 210 L75 300 L90 300 Z' },
        ],
        posterior: [
             { id: 'head-post', name: 'Head (Posterior)', d: 'M130 50 A 30 40 0 1 1 70 50 A 30 40 0 1 1 130 50 Z' },
             { id: 'neck-post', name: 'Neck (Posterior)', d: 'M90 90 L110 90 L110 100 L90 100 Z' },
             { id: 'back-post', name: 'Back', d: 'M75 100 L125 100 L125 190 L75 190 Z' },
             { id: 'glutes-post', name: 'Gluteal Region', d: 'M75 190 L125 190 L120 210 L80 210 Z' },
             { id: 'r-arm-post', name: 'Right Arm (Posterior)', d: 'M130 105 L150 105 L150 200 L135 200 Z' },
             { id: 'l-arm-post', name: 'Left Arm (Posterior)', d: 'M70 105 L50 105 L50 200 L65 200 Z' },
             { id: 'r-leg-post', name: 'Right Leg (Posterior)', d: 'M105 210 L125 210 L125 300 L110 300 Z' },
             { id: 'l-leg-post', name: 'Left Leg (Posterior)', d: 'M95 210 L75 210 L75 300 L90 300 Z' },
        ]
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 grid grid-cols-2 gap-4 p-4 border dark:border-gray-700 rounded-lg">
                <div className="text-center">
                    <h3 className="font-semibold mb-2 dark:text-gray-300">Anterior</h3>
                    <svg viewBox="0 0 200 350">
                        {bodyParts.anterior.map(part => (
                            <BodyPart key={part.id} id={part.id} d={part.d} data-name={part.name} onClick={() => openModal(part.name, part.id)} isInjured={injuredPartIds.includes(part.id)} />
                        ))}
                    </svg>
                </div>
                <div className="text-center">
                     <h3 className="font-semibold mb-2 dark:text-gray-300">Posterior</h3>
                     <svg viewBox="0 0 200 350">
                         {bodyParts.posterior.map(part => (
                            <BodyPart key={part.id} id={part.id} d={part.d} data-name={part.name} onClick={() => openModal(part.name, part.id)} isInjured={injuredPartIds.includes(part.id)} />
                        ))}
                    </svg>
                </div>
            </div>

            <div className="p-4 border dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold mb-2 dark:text-gray-300">Injury Log</h3>
                {value.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No injuries logged. Click a body part to add one.</p>
                ) : (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                        {value.map(injury => (
                            <li key={injury.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold dark:text-gray-200">{injury.location}</p>
                                        <p className="text-gray-600 dark:text-gray-300">{injury.description}</p>
                                    </div>
                                    <button onClick={() => handleRemoveInjury(injury.id)} className="p-1 text-red-500 hover:text-red-700">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {modalState.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={closeModal}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue mb-4">Add Injury: {modalState.location}</h2>
                        <form onSubmit={handleAddInjury}>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Describe the injury..."
                                autoFocus
                                rows={4}
                                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            />
                            <div className="flex justify-end gap-4 mt-4">
                                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90">Add Injury</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveBodyMap;
