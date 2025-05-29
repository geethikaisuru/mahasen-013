import { useState, useCallback } from 'react';
import type { 
  PersonalContextProfile, 
  LearningProgress, 
  PersonalContextLearningInput,
  PersonalContextUpdateInput
} from '@/types/personal-context';

interface PersonalContextState {
  profile: PersonalContextProfile | null;
  progress: LearningProgress | null;
  statistics: {
    hasPersonalContext: boolean;
    contactCount: number;
    patternCount: number;
    lastUpdated?: Date;
    confidence?: number;
  } | null;
  isLoading: boolean;
  error: string | null;
}

export function usePersonalContext() {
  const [state, setState] = useState<PersonalContextState>({
    profile: null,
    progress: null,
    statistics: null,
    isLoading: false,
    error: null
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  // Start learning personal context from Gmail
  const learnPersonalContext = useCallback(async (input: PersonalContextLearningInput) => {
    setLoading(true);
    setError(null);

    try {
      // Validate that we have the required authentication
      if (!input.userId || !input.accessToken) {
        throw new Error('Authentication required: Missing user ID or access token');
      }

      const response = await fetch('/api/personal-context/learn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Learning failed');
      }

      setState(prev => ({
        ...prev,
        profile: result.profile,
        isLoading: false
      }));

      return { success: true, profile: result.profile };
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  // Get personal context profile
  const getPersonalContext = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/personal-context/profile?userId=${userId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get profile');
      }

      setState(prev => ({
        ...prev,
        profile: result.profile,
        isLoading: false
      }));

      return { success: true, profile: result.profile };
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  // Update personal context with new interaction
  const updatePersonalContext = useCallback(async (input: PersonalContextUpdateInput) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/personal-context/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Update failed');
      }

      setLoading(false);
      return { success: true, updates: result.updates };
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  // Get learning progress
  const getLearningProgress = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/personal-context/learn?userId=${userId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get progress');
      }

      setState(prev => ({
        ...prev,
        progress: result.progress,
        isLoading: false
      }));

      return { success: true, progress: result.progress };
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  // Get user statistics
  const getUserStatistics = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/personal-context/statistics?userId=${userId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get statistics');
      }

      setState(prev => ({
        ...prev,
        statistics: result.statistics,
        isLoading: false
      }));

      return { success: true, statistics: result.statistics };
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  // Test Gmail connection
  const testGmailConnection = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError(null);

    try {
      if (!accessToken) {
        throw new Error('Access token is required for Gmail connection test');
      }

      const response = await fetch('/api/personal-context/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken }),
      });

      const result = await response.json();

      setLoading(false);
      return { 
        success: result.success, 
        error: result.error,
        message: result.message 
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  // Delete personal context data
  const deletePersonalContextData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/personal-context/profile?userId=${userId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Delete failed');
      }

      setState(prev => ({
        ...prev,
        profile: null,
        progress: null,
        statistics: null,
        isLoading: false
      }));

      return { success: true };
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [setLoading, setError]);

  return {
    // State
    profile: state.profile,
    progress: state.progress,
    statistics: state.statistics,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    learnPersonalContext,
    getPersonalContext,
    updatePersonalContext,
    getLearningProgress,
    getUserStatistics,
    testGmailConnection,
    deletePersonalContextData,

    // Utilities
    setError,
    clearError: () => setError(null)
  };
} 