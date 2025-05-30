import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceChatService, VoiceChatState, AudioVisualizationData } from '@/services/voice-chat.service';

interface UseVoiceChatOptions {
  apiKey?: string;
  autoInit?: boolean;
}

export function useVoiceChat(options: UseVoiceChatOptions = {}) {
  const [state, setState] = useState<VoiceChatState>('idle');
  const [audioData, setAudioData] = useState<AudioVisualizationData>({
    volume: 0,
    isListening: false,
    isSpeaking: false
  });
  const [transcript, setTranscript] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const serviceRef = useRef<VoiceChatService | null>(null);

  // Initialize the service
  const initialize = useCallback(async () => {
    if (!options.apiKey) {
      setError('Google Gemini API key is required');
      return false;
    }

    try {
      const service = new VoiceChatService({ apiKey: options.apiKey });
      
      service.setCallbacks({
        onStateChange: setState,
        onAudioVisualization: setAudioData,
        onTranscript: (text, isFinal) => {
          if (isFinal) {
            setTranscript(text);
          }
        },
        onResponse: setResponse,
        onError: (err) => setError(err.message)
      });

      await service.initializeSession();
      serviceRef.current = service;
      setIsInitialized(true);
      setError(null);
      return true;
    } catch (err) {
      setError(`Failed to initialize voice chat: ${(err as Error).message}`);
      return false;
    }
  }, [options.apiKey]);

  // Auto-initialize if requested
  useEffect(() => {
    if (options.autoInit && options.apiKey && !isInitialized) {
      initialize();
    }
  }, [options.autoInit, options.apiKey, isInitialized, initialize]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!serviceRef.current) {
      const success = await initialize();
      if (!success) return;
    }

    try {
      await serviceRef.current?.startListening();
      setError(null);
    } catch (err) {
      setError(`Failed to start listening: ${(err as Error).message}`);
    }
  }, [initialize]);

  // Stop listening
  const stopListening = useCallback(() => {
    try {
      serviceRef.current?.stopListening();
      setError(null);
    } catch (err) {
      setError(`Failed to stop listening: ${(err as Error).message}`);
    }
  }, []);

  // Toggle listening state
  const toggleListening = useCallback(() => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle') {
      startListening();
    }
  }, [state, startListening, stopListening]);

  // Get current state info
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isProcessing = state === 'processing';
  const isActive = state !== 'idle';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      serviceRef.current?.dispose();
    };
  }, []);

  return {
    // State
    state,
    audioData,
    transcript,
    response,
    error,
    isInitialized,
    
    // Computed states
    isListening,
    isSpeaking,
    isProcessing,
    isActive,
    
    // Actions
    initialize,
    startListening,
    stopListening,
    toggleListening,
    
    // Clear functions
    clearTranscript: () => setTranscript(''),
    clearResponse: () => setResponse(''),
    clearError: () => setError(null)
  };
} 