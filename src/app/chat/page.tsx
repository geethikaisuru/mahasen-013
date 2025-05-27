
"use client";

import { ChatView } from "@/app/mail/components/chat-view"; // Using existing ChatView component
import { MessageCircle } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="mb-2"> {/* Added margin-bottom for spacing from ChatView card */}
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          <MessageCircle className="mr-3 h-8 w-8 text-primary" />
          AI Chat Assistant
        </h1>
        <p className="text-muted-foreground mt-1">
          Interact with your personal AI assistant.
        </p>
      </div>
      {/* The ChatView component itself contains a Card and handles its own structure and height */}
      <div className="flex-grow"> {/* This container helps ChatView position correctly if it were to fill height */}
         <ChatView />
      </div>
    </div>
  );
}
