import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveChatService, LiveChatState, AudioVisualizationData } from '@/services/gemini-live-chat.service';

interface UseGeminiLiveChatOptions {
  autoInit?: boolean;
}

export function useGeminiLiveChat(options: UseGeminiLiveChatOptions = {}) {
  const [state, setState] = useState<LiveChatState>('idle');
  const [audioData, setAudioData] = useState<AudioVisualizationData>({
    volume: 0,
    isListening: false,
    isSpeaking: false,
    speakingVolume: 0
  });
  const [transcript, setTranscript] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'user' | 'ai';
    text: string;
    timestamp: Date;
  }>>([]);
  
  const serviceRef = useRef<GeminiLiveChatService | null>(null);

  // Get API key from environment variables
  const getApiKey = (): string | null => {
    const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (envKey && envKey !== 'your_api_key_here') {
      return envKey;
    }
    return null;
  };

  // Initialize the service
  const initialize = useCallback(() => {
    const apiKey = getApiKey();
    
    if (!apiKey) {
      setError('Gemini API key not found. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.');
      return false;
    }

    try {
      const service = new GeminiLiveChatService({ 
        apiKey,
        systemInstruction: "Your Name is Mahasen, You are a helpful AI Assistant. Respond naturally and conversationally."
      });
      
      service.setCallbacks({
        onStateChange: setState,
        onAudioVisualization: setAudioData,
        onTranscript: (text) => {
          setTranscript(text);
          setConversationHistory(prev => [
            ...prev,
            { type: 'user', text, timestamp: new Date() }
          ]);
        },
        onResponse: (text) => {
          setResponse(text);
          setConversationHistory(prev => [
            ...prev,
            { type: 'ai', text, timestamp: new Date() }
          ]);
        },
        onError: (err) => setError(err.message)
      });

      serviceRef.current = service;
      setError(null);
      return true;
    } catch (err) {
      setError(`Failed to initialize live chat: ${(err as Error).message}`);
      return false;
    }
  }, []);

  // Auto-initialize if requested
  useEffect(() => {
    if (options.autoInit) {
      initialize();
    }
  }, [options.autoInit, initialize]);

  // Start conversation
  const startConversation = useCallback(async () => {
    if (!serviceRef.current) {
      const success = initialize();
      if (!success) return;
    }

    try {
      await serviceRef.current?.startConversation();
      setError(null);
    } catch (err) {
      setError(`Failed to start conversation: ${(err as Error).message}`);
    }
  }, [initialize]);

  // Stop conversation
  const stopConversation = useCallback(() => {
    try {
      serviceRef.current?.stopConversation();
      setError(null);
    } catch (err) {
      setError(`Failed to stop conversation: ${(err as Error).message}`);
    }
  }, []);

  // Toggle conversation state
  const toggleConversation = useCallback(() => {
    if (state === 'idle' || state === 'error') {
      startConversation();
    } else {
      stopConversation();
    }
  }, [state, startConversation, stopConversation]);

  // Clear conversation history
  const clearHistory = useCallback(() => {
    setConversationHistory([]);
    setTranscript('');
    setResponse('');
  }, []);

  // Get current state info
  const isIdle = state === 'idle';
  const isConnecting = state === 'connecting';
  const isConnected = state === 'connected';
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const hasError = state === 'error';
  const isActive = !isIdle && !hasError;

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
    conversationHistory,
    
    // Computed states
    isIdle,
    isConnecting,
    isConnected,
    isListening,
    isSpeaking,
    hasError,
    isActive,
    
    // Actions
    initialize,
    startConversation,
    stopConversation,
    toggleConversation,
    clearHistory,
    
    // Utilities
    clearError: () => setError(null),
    hasApiKey: () => !!getApiKey()
  };
} 