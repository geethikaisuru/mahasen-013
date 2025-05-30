"use client";

import { useState } from "react";
import { GlossyCircle } from "@/components/ui/glossy-circle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LiveVoiceChatPage() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[600px] gap-8 p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
          Live Voice Chat
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Have a natural conversation with GAIA, your AI assistant
        </p>
      </div>

      {/* Main AI Visual */}
      <div className="flex flex-col items-center">
        <GlossyCircle 
          className="mb-8" 
          isExpanded={false}
        />
        
        {/* Status Indicator */}
        <div className="text-center mb-8">
          {isListening ? (
            <div className="flex items-center gap-2 text-green-500">
              <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium">Listening...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span>Ready to chat</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-lg">Voice Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center gap-4">
          <Button
            size="lg"
            variant={isListening ? "destructive" : "default"}
            onClick={toggleListening}
            className={cn(
              "h-16 w-16 rounded-full transition-all duration-300",
              isListening ? "scale-110 animate-pulse" : "hover:scale-105"
            )}
          >
            {isListening ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>

          <Button
            size="lg"
            variant={isSpeakerOn ? "default" : "outline"}
            onClick={toggleSpeaker}
            className="h-16 w-16 rounded-full hover:scale-105 transition-all duration-300"
          >
            {isSpeakerOn ? (
              <Volume2 className="h-6 w-6" />
            ) : (
              <VolumeX className="h-6 w-6" />
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <div className="text-center text-sm text-muted-foreground max-w-md">
        <p>Click the microphone button to start talking with GAIA. Use the speaker button to control audio output.</p>
      </div>
    </div>
  );
} 