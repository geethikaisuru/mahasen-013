
"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit3, CheckCircle } from "lucide-react";
import { useState, useEffect } from 'react';

interface DraftSummaryCardProps {
  draftNumber: number;
  content: string;
  onSelectDraft: (content: string) => void;
  onUpdateDraftContent: (newContent: string) => void; // To update the specific draft in MailPage state
}

export function DraftSummaryCard({ draftNumber, content, onSelectDraft, onUpdateDraftContent }: DraftSummaryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState(content);

  useEffect(() => {
    setEditableContent(content);
  }, [content]);

  const handleEditToggle = () => {
    if (isEditing) {
      onUpdateDraftContent(editableContent); // Save changes back up to MailPage state
    }
    setIsEditing(!isEditing);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableContent(e.target.value);
    if(isEditing) { // Live update if already in edit mode
        onUpdateDraftContent(e.target.value);
    }
  };
  
  const handleUseDraft = () => {
    if (isEditing) { // Save any pending edits before selecting
        onUpdateDraftContent(editableContent);
        setIsEditing(false);
    }
    onSelectDraft(editableContent);
  };

  return (
    <Card className="flex flex-col shadow-md h-full">
      <CardHeader>
        <CardTitle className="text-lg">Draft {draftNumber}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <Textarea
          value={editableContent}
          onChange={handleContentChange}
          readOnly={!isEditing}
          className="w-full h-full min-h-[150px] resize-none" // Added w-full
          placeholder="Email draft content..."
        />
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
        <Button variant="outline" size="sm" onClick={handleEditToggle}>
          <Edit3 className="mr-2 h-4 w-4" /> {isEditing ? "Save Draft" : "Edit Draft"}
        </Button>
        <Button size="sm" onClick={handleUseDraft} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <CheckCircle className="mr-2 h-4 w-4" /> Use This Draft
        </Button>
      </CardFooter>
    </Card>
  );
}
