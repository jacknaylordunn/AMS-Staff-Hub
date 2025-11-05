

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
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
  // New properties for multi-ePRF
  openEPRFDrafts: EPRFForm[];
  activeEPRFId: string | null;
  setOpenEPRFDrafts: (drafts: EPRFForm[]) => void;
  setActiveEPRFId: (id: string | null) => void;
  updateOpenEPRFDraft: (updatedDraft: EPRFForm) => void;
  addEPRFDraft: (draft: EPRFForm) => void;
  removeEPRFDraft: (id: string) => void;
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

   // New state for multi-ePRF
  const [openEPRFDrafts, setOpenEPRFDrafts] = useState<EPRFForm[]>([]);
  const [activeEPRFId, setActiveEPRFId] = useState<string | null>(null);

  const updateOpenEPRFDraft = (updatedDraft: EPRFForm) => {
      setOpenEPRFDrafts(prev => prev.map(d => d.id === updatedDraft.id ? updatedDraft : d));
  };

  const addEPRFDraft = (draft: EPRFForm) => {
      setOpenEPRFDrafts(prev => [...prev, draft]);
  };

  const removeEPRFDraft = (id: string) => {
      setOpenEPRFDrafts(prev => prev.filter(d => d.id !== id));
  };


  const setActiveShift = async (shift: Shift) => {
    sessionStorage.setItem('activeShift', JSON.stringify(shift));
    setActiveShiftState(shift);
    
    // When a new shift is set, clear any previous EPRF drafts
    setOpenEPRFDrafts([]);
    setActiveEPRFId(null);
    
    // Also set the corresponding event for components that rely on it
    try {
        const eventDetails = await getEventById(shift.eventId);
        const eventLog: EventLog = {
          id: shift.eventId,
          name: shift.eventName,
          date: shift.start.toDate().toISOString().split('T')[0],
          location: eventDetails?.location || '', // Use fetched location
          status: 'Active'
        };
        sessionStorage.setItem('activeEvent', JSON.stringify(eventLog));
        setActiveEventState(eventLog);
    } catch(e) {
        console.error("Could not fetch event details for active shift", e);
        // Fallback with what we have
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
        await setActiveShift(currentShift);
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
      // Also clear any open ePRFs when logging off
      setOpenEPRFDrafts([]);
      setActiveEPRFId(null);
  };

  const setActiveEvent = (event: EventLog) => {
    // When manually setting an event, ensure any active shift is cleared first
    if(activeShift) {
        sessionStorage.removeItem('activeShift');
        setActiveShiftState(null);
    }
    // Always clear ePRF state when the event context changes to prevent glitches
    setOpenEPRFDrafts([]);
    setActiveEPRFId(null);

    sessionStorage.setItem('activeEvent', JSON.stringify(event));
    setActiveEventState(event);
  };


  return (
    <AppContext.Provider value={{ 
        activeEvent, 
        activeShift, 
        setActiveEvent, 
        setActiveShift, 
        clearActiveSession,
        // New values
        openEPRFDrafts,
        activeEPRFId,
        setOpenEPRFDrafts,
        setActiveEPRFId,
        updateOpenEPRFDraft,
        addEPRFDraft,
        removeEPRFDraft
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
