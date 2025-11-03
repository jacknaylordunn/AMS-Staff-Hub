
import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { EventLog } from '../types';

interface AppContextType {
  activeEvent: EventLog | null;
  setActiveEvent: (event: EventLog) => void;
  clearActiveEvent: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeEvent, setActiveEventState] = useState<EventLog | null>(() => {
    const savedEvent = sessionStorage.getItem('activeEvent');
    return savedEvent ? JSON.parse(savedEvent) : null;
  });

  const setActiveEvent = (event: EventLog) => {
    sessionStorage.setItem('activeEvent', JSON.stringify(event));
    setActiveEventState(event);
  };

  const clearActiveEvent = () => {
    sessionStorage.removeItem('activeEvent');
    setActiveEventState(null);
  };

  return (
    <AppContext.Provider value={{ activeEvent, setActiveEvent, clearActiveEvent }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
