
"use client";

// This component (<DraftCard>) might be too complex if each of the 3 generated drafts
// is simpler and primarily serves to be selected into a main composer.
// The new component `DraftSummaryCard.tsx` is introduced for that purpose.
// This original `DraftCard` could be used if you want a more standalone, fully editable draft
// that can also be sent directly.
// For now, I'm marking this as potentially deprecated or for alternative use,
// as `MailPage` now uses `DraftSummaryCard`.

import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Send, Copy, CheckCircle } from "lucide-react";

interface DraftCardProps {
  draftNumber: number;
  initialContent: string;
  onContentChange?: (newContent: string) => void; // Optional: For live updates if used in a complex scenario
  onSelectForMainComposer?: (content: string) => void; // New prop for the "Use This Draft" flow
}

export function DraftCard({ draftNumber, initialContent, onContentChange, onSelectForMainComposer }: DraftCardProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);
  
  const handleEditSave = () => {
    if (isEditing) {
      onContentChange?.(content); // Save changes if callback provided
    }
    setIsEditing(!isEditing);
  };

  const handleSend = () => {
    // This send is specific to this card, might be confusing with a central composer's send.
    toast({
      title: "Email Sent (Mocked from DraftCard)",
      description: `Draft ${draftNumber} content would be sent.`,
      variant: "default",
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

  const handleUseDraft = () => {
    if (isEditing) { // Save any local edits before passing to main composer
        onContentChange?.(content);
        setIsEditing(false);
    }
    onSelectForMainComposer?.(content);
  };

  return (
    <Card className="flex flex-col shadow-md h-full">
      <CardHeader>
        <CardTitle className="text-lg">Draft {draftNumber} (Original Card)</CardTitle>
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
      <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleEditSave}>
            <Edit3 className="mr-2 h-4 w-4" /> {isEditing ? "Save" : "Edit"}
          </Button>
        </div>
        <div className="flex gap-2">
          {onSelectForMainComposer && (
             <Button size="sm" onClick={handleUseDraft} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <CheckCircle className="mr-2 h-4 w-4" /> Use This
             </Button>
          )}
          <Button size="sm" onClick={handleSend} className="bg-muted-green hover:bg-muted-green/90 text-white">
            <Send className="mr-2 h-4 w-4" /> Send
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// If this component is no longer directly used by MailPage, provide a clear export or indication.
export default DraftCard;
