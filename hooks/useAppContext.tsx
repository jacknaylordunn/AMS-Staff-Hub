import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { EventLog, Shift } from '../types';
import { useAuth } from './useAuth';
import { getShiftsForUser } from '../services/firestoreService';

interface AppContextType {
  activeEvent: EventLog | null;
  setActiveEvent: (event: EventLog) => void;
  clearActiveEvent: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeEvent, setActiveEventState] = useState<EventLog | null>(() => {
    try {
      const savedEvent = sessionStorage.getItem('activeEvent');
      return savedEvent ? JSON.parse(savedEvent) : null;
    } catch (e) {
      return null;
    }
  });

  // Auto-logon to event if user has an active shift
  useEffect(() => {
    const checkActiveShift = async (uid: string) => {
      const now = new Date();
      // Check today's shifts
      const shifts = await getShiftsForUser(uid, now.getFullYear(), now.getMonth());
      const activeShift = shifts.find(s => {
          const start = s.start.toDate();
          const end = s.end.toDate();
          return now >= start && now <= end;
      });

      if (activeShift) {
        // Construct a partial EventLog from shift data for the context
        const eventLog: EventLog = {
          id: activeShift.eventId,
          name: activeShift.eventName,
          date: activeShift.start.toDate().toISOString().split('T')[0],
          location: '', // Location is not on shift object, this is acceptable for context
          status: 'Active'
        };
        setActiveEvent(eventLog);
      }
    };
    
    // Only run if user is logged in and no event is manually set
    if (user && !activeEvent) {
      checkActiveShift(user.uid);
    }
  }, [user]);

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