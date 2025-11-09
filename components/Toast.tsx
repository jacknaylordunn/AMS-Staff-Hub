

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners: Array<(toasts: ToastMessage[]) => void> = [];
let toasts: ToastMessage[] = [];

const toast = (message: string, type: ToastType) => {
  toasts = [...toasts, { id: toastId++, message, type }];
  listeners.forEach(listener => listener(toasts));
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== toastId - 1);
    listeners.forEach(listener => listener(toasts));
  }, 3000);
};

export const showToast = (message: string, type: ToastType = 'info') => {
  toast(message, type);
};

const getToastStyles = (type: ToastType) => {
    switch (type) {
        case 'success':
            return 'bg-green-500 text-white';
        case 'error':
            return 'bg-red-500 text-white';
        case 'info':
        default:
            return 'bg-ams-blue text-white dark:bg-ams-light-blue dark:text-ams-blue';
    }
}

export const ToastContainer: React.FC = () => {
  const [localToasts, setLocalToasts] = useState(toasts);

  useEffect(() => {
    const newListener = (newToasts: ToastMessage[]) => {
      setLocalToasts(newToasts);
    };
    listeners.push(newListener);
    return () => {
      listeners.splice(listeners.indexOf(newListener), 1);
    };
  }, []);

  if (typeof document === 'undefined') {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="fixed bottom-5 right-5 z-50 space-y-2">
      {localToasts.map(t => (
        <div key={t.id} className={`px-4 py-2 rounded-md shadow-lg text-sm font-semibold animate-fade-in-out ${getToastStyles(t.type)}`}>
          {t.message}
        </div>
      ))}
       <style>{`
            @keyframes fade-in-out {
                0% { opacity: 0; transform: translateY(20px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(20px); }
            }
            .animate-fade-in-out {
                animation: fade-in-out 3s forwards;
            }
        `}</style>
    </div>,
    document.body
  );
};