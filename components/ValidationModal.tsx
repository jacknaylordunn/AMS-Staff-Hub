import React from 'react';

interface ValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    errors: string[];
}

const ValidationModal: React.FC<ValidationModalProps> = ({ isOpen, onClose, errors }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" 
            onClick={onClose}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="validation-modal-title"
            aria-describedby="validation-modal-description"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <h2 id="validation-modal-title" className="text-xl font-bold text-red-600 dark:text-red-500 mb-4">Incomplete Report</h2>
                <div id="validation-modal-description">
                    <p className="text-gray-600 dark:text-gray-300 mb-4">Please address the following issues before finalizing the ePRF:</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-200">
                        {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ValidationModal;