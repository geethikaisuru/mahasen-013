"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (inputValue.trim() === "" || isLoading) return;

    const userMessage = inputValue;
    setInputValue("");
    setIsLoading(true);

    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: userMessage,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    
    // Add typing indicator
    const typingMessage: Message = {
      id: "typing",
      text: "AI is thinking...",
      sender: "ai",
      timestamp: new Date(),
    };
    setMessages((prevMessages) => [...prevMessages, typingMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
             // Remove typing indicator and add AI response
       setMessages((prevMessages) => {
         const withoutTyping = prevMessages.filter(msg => msg.id !== "typing");
         const aiResponse: Message = {
           id: (Date.now() + 1).toString(),
           text: data.response,
           sender: "ai",
           timestamp: new Date(),
         };
         return [...withoutTyping, aiResponse];
       });

     } catch (error) {
       console.error('Error sending message:', error);
       
       // Remove typing indicator and show error
       setMessages((prevMessages) => {
         const withoutTyping = prevMessages.filter(msg => msg.id !== "typing");
         const errorMessage: Message = {
           id: (Date.now() + 1).toString(),
           text: "Sorry, I'm having trouble responding right now. Please try again.",
           sender: "ai",
           timestamp: new Date(),
         };
         return [...withoutTyping, errorMessage];
       });
     } finally {
       setIsLoading(false);
     }
  };

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);


  return (
    <Card className="shadow-md flex flex-col h-[600px]">
      <CardHeader>
        <CardTitle>Chat with AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.sender === "ai" && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://placehold.co/40x40.png?text=AI" data-ai-hint="robot avatar" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                    message.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <p>{message.text}</p>
                  <p className={`text-xs mt-1 ${message.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {message.sender === "user" && (
                  <Avatar className="h-8 w-8">
                     <AvatarImage src="https://placehold.co/40x40.png?text=ME" data-ai-hint="profile avatar" />
                    <AvatarFallback>ME</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <div className="flex w-full items-center space-x-2">
          <Input
            type="text"
            placeholder={isLoading ? "AI is thinking..." : "Type your message..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
            disabled={isLoading}
            className="flex-grow"
          />
          <Button type="submit" size="icon" onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
