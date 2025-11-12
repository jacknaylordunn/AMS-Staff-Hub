

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import type { Shift, EPRFForm, TimeClockEntry } from '../types';
import { useAuth } from './useAuth';
import { getActiveClockInForUser } from '../services/timeClockService';


interface AppContextType {
  activeClockIn: TimeClockEntry | null;
  setActiveClockIn: (clockInEntry: TimeClockEntry | null) => void;
  clearLocalSession: () => void;
  openEPRFDrafts: EPRFForm[];
  activeEPRFId: string | null;
  addEPRFDraft: (draft: EPRFForm) => void;
  removeEPRFDraft: (draftId: string) => void;
  setActiveEPRFId: (draftId: string | null) => void;
  updateEPRFDraft: (draft: EPRFForm) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [activeClockIn, setActiveClockInState] = useState<TimeClockEntry | null>(() => {
    try {
      const saved = sessionStorage.getItem('activeClockIn');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Re-hydrate Timestamps and GeoPoints
      if (parsed.clockInTime) parsed.clockInTime = new firebase.firestore.Timestamp(parsed.clockInTime.seconds, parsed.clockInTime.nanoseconds);
      if (parsed.clockOutTime) parsed.clockOutTime = new firebase.firestore.Timestamp(parsed.clockOutTime.seconds, parsed.clockOutTime.nanoseconds);
      if (parsed.clockInLocation) parsed.clockInLocation = new firebase.firestore.GeoPoint(parsed.clockInLocation.latitude, parsed.clockInLocation.longitude);
      if (parsed.clockOutLocation) parsed.clockOutLocation = new firebase.firestore.GeoPoint(parsed.clockOutLocation.latitude, parsed.clockOutLocation.longitude);
      return parsed;
    } catch (e) {
      console.error("Failed to parse activeClockIn from sessionStorage", e);
      return null;
    }
  });
  
  const [openEPRFDrafts, setOpenEPRFDrafts] = useState<EPRFForm[]>([]);
  const [activeEPRFId, setActiveEPRFIdState] = useState<string | null>(null);

  useEffect(() => {
    const checkActiveSession = async (uid: string) => {
        const activeEntry = await getActiveClockInForUser(uid);
        setActiveClockIn(activeEntry);
    };
    
    if (user && !activeClockIn) {
      checkActiveSession(user.uid);
    }
  }, [user]);

  const setActiveClockIn = (clockInEntry: TimeClockEntry | null) => {
    if (clockInEntry) {
        sessionStorage.setItem('activeClockIn', JSON.stringify(clockInEntry));
    } else {
        sessionStorage.removeItem('activeClockIn');
    }
    setActiveClockInState(clockInEntry);
  };
  
  const clearLocalSession = () => {
      sessionStorage.removeItem('activeClockIn');
      setActiveClockInState(null);
  };

  const addEPRFDraft = (draft: EPRFForm) => {
    setOpenEPRFDrafts(prev => {
        if (prev.some(d => d.id === draft.id)) {
            return prev.map(d => d.id === draft.id ? draft : d);
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

  const updateEPRFDraft = useCallback((updatedDraft: EPRFForm) => {
    setOpenEPRFDrafts(prevDrafts =>
        prevDrafts.map(draft =>
            draft.id === updatedDraft.id ? updatedDraft : draft
        )
    );
  }, []);


  return (
    <AppContext.Provider value={{ 
        activeClockIn,
        setActiveClockIn,
        clearLocalSession,
        openEPRFDrafts,
        activeEPRFId,
        setActiveEPRFId,
        addEPRFDraft,
        removeEPRFDraft,
        updateEPRFDraft
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