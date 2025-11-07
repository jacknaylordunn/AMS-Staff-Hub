import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SpinnerIcon } from './icons';
import { showToast } from './Toast';

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (blob: Blob) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState('');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startStream = useCallback(async (deviceId: string) => {
        stopStream();
        setError('');
        try {
            const constraints = {
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    facingMode: 'environment', // Prefer rear camera
                },
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(console.error);
            }
        } catch (err: any) {
            console.error('Camera access error:', err);
             if (err.name === 'NotAllowedError') {
                setError('Camera permission denied. Please enable it in your browser settings.');
            } else {
                setError('Could not access camera. Is it in use by another app?');
            }
        }
    }, [stopStream]);

    useEffect(() => {
        if (isOpen) {
            navigator.mediaDevices.enumerateDevices()
                .then(allDevices => {
                    const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
                    setDevices(videoDevices);
                    const rearCamera = videoDevices.find(d => d.label.toLowerCase().includes('back')) || videoDevices[0];
                    if (rearCamera) {
                        setSelectedDeviceId(rearCamera.deviceId);
                        startStream(rearCamera.deviceId);
                    } else if (videoDevices.length > 0) {
                         setSelectedDeviceId(videoDevices[0].deviceId);
                         startStream(videoDevices[0].deviceId);
                    } else {
                        setError("No camera found on this device.");
                    }
                })
                .catch(() => setError("Could not enumerate devices."));
        } else {
            stopStream();
            setCapturedImage(null);
        }

        return () => {
            stopStream();
        };
    }, [isOpen, startStream, stopStream]);
    
    useEffect(() => {
        if (selectedDeviceId) {
            startStream(selectedDeviceId);
        }
    }, [selectedDeviceId, startStream]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            setCapturedImage(canvas.toDataURL('image/jpeg'));
            stopStream();
        }
    };
    
    const handleRetake = () => {
        setCapturedImage(null);
        startStream(selectedDeviceId);
    };

    const handleUsePhoto = () => {
        if (canvasRef.current) {
            canvasRef.current.toBlob(blob => {
                if(blob) {
                    onCapture(blob);
                    onClose();
                } else {
                    showToast("Failed to process image.", "error");
                }
            }, 'image/jpeg', 0.9);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-center mb-2">Take Photo</h2>
                <div className="relative w-full aspect-[4/3] bg-gray-900 rounded-md overflow-hidden">
                    {error ? <div className="flex items-center justify-center h-full text-red-500 p-4 text-center">{error}</div> :
                        <>
                            <video ref={videoRef} className={`w-full h-full object-cover ${capturedImage ? 'hidden' : ''}`} playsInline />
                            {capturedImage && <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />}
                            <canvas ref={canvasRef} className="hidden" />
                        </>
                    }
                </div>
                 {devices.length > 1 && !capturedImage && (
                    <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} className="w-full mt-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.substring(0,5)}`}</option>)}
                    </select>
                )}
                <div className="flex justify-center gap-4 mt-4">
                    {capturedImage ? (
                        <>
                           <button onClick={handleRetake} className="px-4 py-2 bg-gray-300 rounded-md">Retake</button>
                           <button onClick={handleUsePhoto} className="px-4 py-2 bg-ams-blue text-white rounded-md">Use Photo</button>
                        </>
                    ) : (
                        <button onClick={handleCapture} disabled={!!error} className="w-16 h-16 rounded-full bg-white border-4 border-ams-blue disabled:opacity-50" aria-label="Capture photo" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default CameraModal;