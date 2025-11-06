import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
// FIX: The error indicates Timestamp is not exported. Using namespace import `* as firestore` from 'firebase/firestore' to fix module resolution issues.
import * as firestore from 'firebase/firestore';
import type { EventLog, Shift, EPRFForm } from '../types';
import { useAuth } from './useAuth';
import { getShiftsForUser } from '../services/rotaService';
import { getEventById } from '../services/eventService';

interface AppContextType {
  activeEvent: EventLog | null;
  activeShift: Shift | null;
  setActiveEvent: (event: EventLog) => void;
  setActiveShift: (shift: Shift) => Promise<void>;
  clearActiveSession: () => void;
  openEPRFDrafts: EPRFForm[];
  activeEPRFId: string | null;
  addEPRFDraft: (draft: EPRFForm) => void;
  removeEPRFDraft: (draftId: string) => void;
  setActiveEPRFId: (draftId: string | null) => void;
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
            parsed.start = new firestore.Timestamp(parsed.start.seconds, parsed.start.nanoseconds);
            parsed.end = new firestore.Timestamp(parsed.end.seconds, parsed.end.nanoseconds);
        }
        return parsed;
    } catch (e) {
        console.error("Failed to parse activeShift from sessionStorage", e);
        return null;
    }
  });
  
  const [openEPRFDrafts, setOpenEPRFDrafts] = useState<EPRFForm[]>([]);
  const [activeEPRFId, setActiveEPRFIdState] = useState<string | null>(null);

  const setActiveShift = async (shift: Shift) => {
    sessionStorage.setItem('activeShift', JSON.stringify(shift));
    setActiveShiftState(shift);
    
    try {
        const eventDetails = await getEventById(shift.eventId);
        const eventLog: EventLog = {
          id: shift.eventId,
          name: shift.eventName,
          date: shift.start.toDate().toISOString().split('T')[0],
          location: eventDetails?.location || '', 
          status: 'Active'
        };
        sessionStorage.setItem('activeEvent', JSON.stringify(eventLog));
        setActiveEventState(eventLog);
    } catch(e) {
        console.error("Could not fetch event details for active shift", e);
        const eventLog: EventLog = {
          id: shift.eventId,
          name: shift.eventName,
          date: shift.start.toDate().toISOString().split('T')[0],
          location: '', 
          status: 'Active'
        };
        sessionStorage.setItem('activeEvent', JSON.stringify(eventLog));
        setActiveEventState(eventLog);
    }
  };

  useEffect(() => {
    const checkActiveShift = async (uid: string) => {
      const now = new Date();
      const shifts = await getShiftsForUser(uid, now.getFullYear(), now.getMonth());
      const currentShift = shifts.find(s => {
          const start = s.start.toDate();
          const end = s.end.toDate();
          return now >= start && now <= end && !s.isUnavailability;
      });

      if (currentShift) {
        await setActiveShift(currentShift);
      }
    };
    
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
    if(activeShift) {
        sessionStorage.removeItem('activeShift');
        setActiveShiftState(null);
    }
    
    sessionStorage.setItem('activeEvent', JSON.stringify(event));
    setActiveEventState(event);
  };
  
  const addEPRFDraft = (draft: EPRFForm) => {
    setOpenEPRFDrafts(prev => {
        if (prev.some(d => d.id === draft.id)) {
            return prev;
        }
        return [...prev, draft];
    });
  };

  const removeEPRFDraft = (draftId: string) => {
    setOpenEPRFDrafts(prev => prev.filter(d => d.id !== draftId));
  };

  const setActiveEPRFId = (draftId: string | null) => {
    setActiveEPRFIdState(draftId);
  }


  return (
    <AppContext.Provider value={{ 
        activeEvent, 
        activeShift, 
        setActiveEvent, 
        setActiveShift, 
        clearActiveSession,
        openEPRFDrafts,
        activeEPRFId,
        setActiveEPRFId,
        addEPRFDraft,
        removeEPRFDraft,
    }}>
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