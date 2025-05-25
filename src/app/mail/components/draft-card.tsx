"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Send, Copy } from "lucide-react";

interface DraftCardProps {
  draftNumber: number;
  initialContent: string;
  onContentChange: (newContent: string) => void;
}

export function DraftCard({ draftNumber, initialContent, onContentChange }: DraftCardProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);
  
  const handleEdit = () => {
    if (isEditing) {
      onContentChange(content); // Save changes if any
    }
    setIsEditing(!isEditing);
  };

  const handleSend = () => {
    toast({
      title: "Email Sent (Mocked)",
      description: `Draft ${draftNumber} content would be sent.`,
      variant: "default", // Use 'default' variant which uses primary color, or create a 'success' variant if needed.
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      toast({
        title: "Copied to Clipboard",
        description: `Draft ${draftNumber} content copied.`,
      });
    }).catch(err => {
      toast({
        title: "Copy Failed",
        description: "Could not copy text.",
        variant: "destructive",
      });
    });
  };

  return (
    <Card className="flex flex-col shadow-md h-full">
      <CardHeader>
        <CardTitle className="text-lg">Draft {draftNumber}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          readOnly={!isEditing}
          className="h-full min-h-[200px] resize-none"
          placeholder="Email draft content..."
        />
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" /> Copy
        </Button>
        <Button variant="outline" size="sm" onClick={handleEdit}>
          <Edit3 className="mr-2 h-4 w-4" /> {isEditing ? "Save" : "Edit"}
        </Button>
        <Button size="sm" onClick={handleSend} className="bg-muted-green hover:bg-muted-green/90 text-white">
          <Send className="mr-2 h-4 w-4" /> Send
        </Button>
      </CardFooter>
    </Card>
  );
}
