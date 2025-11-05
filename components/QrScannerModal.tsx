import React, { useState, useEffect, useRef } from 'react';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface QrScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (qrValue: string) => void;
}

// Check for BarcodeDetector API support
declare var BarcodeDetector: any;
const isBarcodeDetectorSupported = typeof BarcodeDetector !== 'undefined';

const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onScan }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let animationFrameId: number;

        const startScan = async () => {
            if (!isOpen || !isBarcodeDetectorSupported) {
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });

                const detect = async () => {
                    if (videoRef.current && videoRef.current.readyState >= 2) {
                        try {
                            const barcodes = await barcodeDetector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                onScan(barcodes[0].rawValue);
                                onClose();
                            }
                        } catch (err) {
                            console.error('Barcode detection failed:', err);
                        }
                    }
                    animationFrameId = requestAnimationFrame(detect);
                };

                detect();
            } catch (err: any) {
                console.error('Camera access error:', err);
                if (err.name === 'NotAllowedError') {
                    setError('Camera access was denied. Please allow camera access in your browser settings.');
                } else {
                    setError('Could not access the camera. Please ensure it is not in use by another application.');
                }
            }
        };

        const stopScan = () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            cancelAnimationFrame(animationFrameId);
        };

        if (isOpen) {
            startScan();
        } else {
            stopScan();
        }

        return () => {
            stopScan();
        };
    }, [isOpen, onScan, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-4 relative" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-ams-blue dark:text-ams-light-blue mb-4 text-center">Scan Vehicle QR Code</h2>
                <div className="relative w-full aspect-square bg-gray-900 rounded-md overflow-hidden">
                    {!isBarcodeDetectorSupported ? (
                        <div className="flex items-center justify-center h-full text-center text-red-500 p-4">
                            QR code scanning is not supported by your browser. Please use a recent version of Chrome or Safari.
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-center text-red-500 p-4">{error}</div>
                    ) : (
                        <>
                            <video ref={videoRef} className="w-full h-full object-cover" playsInline />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-3/4 h-3/4 border-4 border-dashed border-white/50 rounded-lg" />
                            </div>
                        </>
                    )}
                </div>
                <button type="button" onClick={onClose} className="mt-4 w-full px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default QrScannerModal;