"use client";

import { useState } from "react";
import { GlossyCircle } from "@/components/ui/glossy-circle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Settings, AlertCircle, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeminiLiveChat } from "@/hooks/use-gemini-live-chat";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LiveVoiceChatPage() {
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Initialize live chat
  const {
    state,
    audioData,
    error,
    conversationHistory,
    isIdle,
    isConnecting,
    isConnected,
    isListening,
    isSpeaking,
    hasError,
    isActive,
    toggleConversation,
    clearHistory,
    clearError,
    hasApiKey
  } = useGeminiLiveChat({
    autoInit: true
  });

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  // Get appropriate button color based on state
  const getConversationButtonColor = () => {
    if (hasError) return "bg-red-500 hover:bg-red-600";
    if (isConnecting) return "bg-yellow-500 hover:bg-yellow-600";
    if (isListening) return "bg-green-500 hover:bg-green-600";
    if (isSpeaking) return "bg-purple-500 hover:bg-purple-600";
    if (isConnected) return "bg-blue-500 hover:bg-blue-600";
    return "bg-gray-500 hover:bg-gray-600";
  };

  // Get button text based on state
  const getButtonText = () => {
    if (hasError) return "Retry Conversation";
    if (isActive) return "Stop Conversation";
    return "Start Conversation";
  };

  // Get status text
  const getStatusText = () => {
    switch (state) {
      case 'connecting': return '🔄 Connecting to Mahasen...';
      case 'connected': return '✅ Connected - Ready to chat';
      case 'listening': return '🎤 Mahasen is listening...';
      case 'speaking': return '🗣️ Mahasen is speaking...';
      case 'error': return '❌ Connection error';
      default: return '💬 Click "Start Conversation" to begin';
    }
  };

  // Show API key error if not available
  if (!hasApiKey()) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[600px] gap-8 p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                Gemini API key not found. Please set <code>NEXT_PUBLIC_GEMINI_API_KEY</code> in your environment variables.
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>To configure the API key:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Get your API key from <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a></li>
                <li>Create a <code>.env.local</code> file in your project root</li>
                <li>Add: <code>NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here</code></li>
                <li>Restart the development server</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[600px] gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Voice Chat with Mahasen</h1>
          <p className="text-muted-foreground">
            Continuous real-time conversation with your AI assistant
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            disabled={conversationHistory.length === 0}
          >
            Clear History
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-1 gap-8">
        {/* Voice Interface */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          {/* Main GlossyCircle */}
          <GlossyCircle 
            className="cursor-pointer"
            voiceState={state}
            audioVolume={audioData.volume}
            onClick={toggleConversation}
          />

          {/* Main Control Button */}
          <div className="flex flex-col items-center gap-4">
            <Button
              size="lg"
              className={cn(
                "rounded-full w-20 h-20 transition-all duration-300",
                getConversationButtonColor()
              )}
              onClick={toggleConversation}
              disabled={isConnecting}
            >
              {isActive ? (
                <Square className="h-8 w-8" />
              ) : (
                <Play className="h-8 w-8" />
              )}
            </Button>
            
            <span className="text-lg font-medium">{getButtonText()}</span>
          </div>

          {/* Speaker Control */}
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full w-16 h-16"
              onClick={toggleSpeaker}
            >
              {isSpeakerOn ? (
                <Volume2 className="h-6 w-6" />
              ) : (
                <VolumeX className="h-6 w-6" />
              )}
            </Button>
          </div>

          {/* Status Text */}
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">{getStatusText()}</p>
            
            {/* Audio Volume Visualization */}
            {(isListening || isSpeaking) && audioData.volume > 0 && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isListening ? 'Your voice:' : 'Mahasen volume:'}
                </span>
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-100",
                      isListening ? "bg-green-500" : "bg-purple-500"
                    )}
                    style={{ width: `${Math.min(audioData.volume * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Conversation Panel */}
        <div className="w-96">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Live Conversation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Real-time chat with Mahasen
              </p>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {conversationHistory.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>Start a conversation to see the chat history!</p>
                  <p className="text-xs mt-2">The conversation will be continuous once started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversationHistory.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-3 rounded-lg",
                        message.type === 'user'
                          ? "bg-blue-50 dark:bg-blue-900/20 ml-4"
                          : "bg-gray-50 dark:bg-gray-800 mr-4"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-xs font-medium opacity-70">
                          {message.type === 'user' ? 'You' : 'Mahasen'}
                        </div>
                        <div className="text-xs opacity-50">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-sm">{message.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Connection Status Bar */}
      <div className="flex items-center justify-center">
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm",
          isConnected && "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
          isConnecting && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
          hasError && "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
          isIdle && "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected && "bg-green-500",
            isConnecting && "bg-yellow-500 animate-pulse",
            hasError && "bg-red-500",
            isIdle && "bg-gray-400"
          )} />
          <span>
            {isConnected && "Live connection active"}
            {isConnecting && "Establishing connection..."}
            {hasError && "Connection failed"}
            {isIdle && "Ready to connect"}
          </span>
        </div>
      </div>
    </div>
  );
} 