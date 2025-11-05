import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';

interface SignaturePadProps {
    width?: number;
    height?: number;
}

export interface SignaturePadRef {
    clear: () => void;
    getSignature: () => string | null; // Returns data URL or null if empty
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(({ width = 400, height = 150 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                setContext(ctx);
            }
        }
    }, []);

    const getCoords = (event: React.MouseEvent | React.TouchEvent): { x: number, y: number } => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if ('touches' in event) {
            return {
                x: event.touches[0].clientX - rect.left,
                y: event.touches[0].clientY - rect.top
            };
        }
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
        if (!context) return;
        const { x, y } = getCoords(event);
        context.beginPath();
        context.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (event: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !context) return;
        event.preventDefault(); // Prevent scrolling on touch devices
        const { x, y } = getCoords(event);
        context.lineTo(x, y);
        context.stroke();
    };

    const stopDrawing = () => {
        if (!context) return;
        context.closePath();
        setIsDrawing(false);
    };
    
    const clearCanvas = () => {
        if (context && canvasRef.current) {
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    const isCanvasBlank = (): boolean => {
        if (!canvasRef.current) return true;
        const blank = document.createElement('canvas');
        blank.width = canvasRef.current.width;
        blank.height = canvasRef.current.height;
        return canvasRef.current.toDataURL() === blank.toDataURL();
    };

    useImperativeHandle(ref, () => ({
        clear: clearCanvas,
        getSignature: () => {
            if (canvasRef.current && !isCanvasBlank()) {
                return canvasRef.current.toDataURL('image/png');
            }
            return null;
        }
    }));

    return (
        <div className="relative w-full max-w-md">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="bg-white border border-gray-300 rounded-md dark:bg-gray-200"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <button
                type="button"
                onClick={clearCanvas}
                className="mt-2 px-4 py-1 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200"
            >
                Clear Signature
            </button>
        </div>
    );
});

export default SignaturePad;
