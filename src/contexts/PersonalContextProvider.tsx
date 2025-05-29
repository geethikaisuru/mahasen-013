"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { PersonalContextProfile } from '@/types/personal-context';
import { personalContextService } from '@/services/personal-context/personal-context-service';

interface PersonalContextState {
  profile: PersonalContextProfile | null;
  userId: string | null;
  isLoading: boolean;
  hasPersonalContext: boolean;
  lastUpdated: Date | null;
}

interface PersonalContextContextType extends PersonalContextState {
  setUserId: (userId: string) => void;
  refreshPersonalContext: () => Promise<void>;
  clearPersonalContext: () => void;
}

const PersonalContextContext = createContext<PersonalContextContextType | undefined>(undefined);

export function usePersonalContextGlobal() {
  const context = useContext(PersonalContextContext);
  if (context === undefined) {
    throw new Error('usePersonalContextGlobal must be used within a PersonalContextProvider');
  }
  return context;
}

interface PersonalContextProviderProps {
  children: React.ReactNode;
  defaultUserId?: string;
}

export function PersonalContextProvider({ 
  children, 
  defaultUserId = "demo-user-123" 
}: PersonalContextProviderProps) {
  const [state, setState] = useState<PersonalContextState>({
    profile: null,
    userId: defaultUserId,
    isLoading: false,
    hasPersonalContext: false,
    lastUpdated: null
  });

  const setUserId = (userId: string) => {
    setState(prev => ({ ...prev, userId }));
  };

  const refreshPersonalContext = async () => {
    if (!state.userId) return;

    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const profile = await personalContextService.getPersonalContext(state.userId);
      
      setState(prev => ({
        ...prev,
        profile,
        hasPersonalContext: !!profile,
        lastUpdated: profile?.lastUpdated || null,
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to refresh personal context:', error);
      setState(prev => ({
        ...prev,
        profile: null,
        hasPersonalContext: false,
        isLoading: false
      }));
    }
  };

  const clearPersonalContext = () => {
    setState(prev => ({
      ...prev,
      profile: null,
      hasPersonalContext: false,
      lastUpdated: null
    }));
  };

  // Load personal context when component mounts or userId changes
  useEffect(() => {
    if (state.userId) {
      refreshPersonalContext();
    }
  }, [state.userId]);

  const contextValue: PersonalContextContextType = {
    ...state,
    setUserId,
    refreshPersonalContext,
    clearPersonalContext
  };

  return (
    <PersonalContextContext.Provider value={contextValue}>
      {children}
    </PersonalContextContext.Provider>
  );
} 