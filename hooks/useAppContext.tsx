

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { EventLog, Shift } from '../types';
import { useAuth } from './useAuth';
import { getShiftsForUser } from '../services/rotaService';

interface AppContextType {
  activeEvent: EventLog | null;
  activeShift: Shift | null;
  setActiveEvent: (event: EventLog) => void;
  setActiveShift: (shift: Shift) => void;
  clearActiveSession: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [activeEvent, setActiveEventState] = useState<EventLog | null>(() => {
    try {
      const savedEvent = sessionStorage.getItem('activeEvent');
      return savedEvent ? JSON.parse(savedEvent) : null;
    } catch (e) {
      console.error("Failed to parse activeEvent from sessionStorage", e);
      return null;
    }
  });

  const [activeShift, setActiveShiftState] = useState<Shift | null>(() => {
    try {
        const savedShift = sessionStorage.getItem('activeShift');
        if (!savedShift) return null;
        const parsed = JSON.parse(savedShift);
        // Re-hydrate Timestamps from plain objects stored in JSON
        if (parsed.start && parsed.end) {
            parsed.start = new Timestamp(parsed.start.seconds, parsed.start.nanoseconds);
            parsed.end = new Timestamp(parsed.end.seconds, parsed.end.nanoseconds);
        }
        return parsed;
    } catch (e) {
        console.error("Failed to parse activeShift from sessionStorage", e);
        return null;
    }
  });

  // Auto-logon to event if user has an active shift
  useEffect(() => {
    const checkActiveShift = async (uid: string) => {
      const now = new Date();
      // Check today's shifts
      const shifts = await getShiftsForUser(uid, now.getFullYear(), now.getMonth());
      const currentShift = shifts.find(s => {
          const start = s.start.toDate();
          const end = s.end.toDate();
          return now >= start && now <= end && !s.isUnavailability;
      });

      if (currentShift) {
        setActiveShift(currentShift);
      }
    };
    
    // Only run if user is logged in and no session is manually set
    if (user && !activeEvent && !activeShift) {
      checkActiveShift(user.uid);
    }
  }, [user]);

  const clearActiveSession = () => {
      sessionStorage.removeItem('activeShift');
      setActiveShiftState(null);
      sessionStorage.removeItem('activeEvent');
      setActiveEventState(null);
  };

  const setActiveEvent = (event: EventLog) => {
    // When manually setting an event, ensure any active shift is cleared first
    if(activeShift) {
        clearActiveSession();
    }
    sessionStorage.setItem('activeEvent', JSON.stringify(event));
    setActiveEventState(event);
  };

  const setActiveShift = (shift: Shift) => {
    sessionStorage.setItem('activeShift', JSON.stringify(shift));
    setActiveShiftState(shift);
    
    // Also set the corresponding event for components that rely on it
    const eventLog: EventLog = {
      id: shift.eventId,
      name: shift.eventName,
      date: shift.start.toDate().toISOString().split('T')[0],
      location: '', // Location is not on shift object, this is acceptable for context
      status: 'Active'
    };
    sessionStorage.setItem('activeEvent', JSON.stringify(eventLog));
    setActiveEventState(eventLog);
  };

  return (
    <AppContext.Provider value={{ activeEvent, activeShift, setActiveEvent, setActiveShift, clearActiveSession }}>
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