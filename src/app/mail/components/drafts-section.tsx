"use client";

import { useState, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DraftCard } from "./draft-card";
import { handleGenerateEmailDrafts, handleRegenerateEmailDrafts } from "@/app/actions";
import type { GenerateEmailDraftsInput, GenerateEmailDraftsOutput } from "@/ai/flows/generate-email-drafts";
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface DraftsSectionProps {
  initialEmailContent: string;
}

export function DraftsSection({ initialEmailContent }: DraftsSectionProps) {
  const [emailContent, setEmailContent] = useState(initialEmailContent);
  const [userContext, setUserContext] = useState("I am a busy professional. I prefer concise and direct communication. Today is " + new Date().toLocaleDateString() + ".");
  const [drafts, setDrafts] = useState<[string, string, string] | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const onGenerateDrafts = () => {
    if (!emailContent.trim()) {
      toast({ title: "Error", description: "Email content cannot be empty.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const input: GenerateEmailDraftsInput = { emailContent, userContext };
      const result = await handleGenerateEmailDrafts(input);
      if ("error" in result || !result.drafts) {
         toast({ title: "Error Generating Drafts", description: (result as any).error || "An unknown error occurred.", variant: "destructive" });
         setDrafts(result.drafts || ["Error", "Error", "Error"]); // Show error in drafts
      } else {
        setDrafts(result.drafts as [string, string, string]);
        toast({ title: "Drafts Generated", description: "Successfully generated 3 email drafts." });
      }
    });
  };

  const onRegenerateDrafts = () => {
    if (!emailContent.trim()) {
      toast({ title: "Error", description: "Email content cannot be empty.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const input: GenerateEmailDraftsInput = { emailContent, userContext };
      // Use handleRegenerateEmailDrafts which calls the regenerate flow
      const result = await handleRegenerateEmailDrafts(input);
      if ("error" in result || !result.draftReplies) {
        toast({ title: "Error Regenerating Drafts", description: (result as any).error || "An unknown error occurred.", variant: "destructive" });
        // Ensure result.draftReplies exists and is an array of 3 strings
        const errorDrafts = (result.draftReplies as [string,string,string]) || ["Error", "Error", "Error"];
        setDrafts(errorDrafts);
      } else {
        setDrafts(result.draftReplies as [string, string, string]);
        toast({ title: "Drafts Regenerated", description: "Successfully regenerated 3 email drafts." });
      }
    });
  };
  
  const handleDraftContentChange = (index: number, newContent: string) => {
    if (drafts) {
      const updatedDrafts = [...drafts] as [string, string, string];
      updatedDrafts[index] = newContent;
      setDrafts(updatedDrafts);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="emailContent" className="text-base font-semibold">Original Email Content (Editable)</Label>
            <Textarea
              id="emailContent"
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder="Paste or write the email content here..."
              className="mt-1 min-h-[150px]"
            />
          </div>
          <div>
            <Label htmlFor="userContext" className="text-base font-semibold">Your Personal Context</Label>
            <Textarea
              id="userContext"
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder="Provide context about yourself, your preferences, or relevant information..."
              className="mt-1 min-h-[100px]"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={onGenerateDrafts} disabled={isPending} className="w-full sm:w-auto">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate Drafts
            </Button>
            {drafts && (
              <Button onClick={onRegenerateDrafts} disabled={isPending} variant="outline" className="w-full sm:w-auto">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate Drafts
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {isPending && !drafts && (
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="shadow-md animate-pulse">
              <div className="p-6 space-y-4">
                <div className="h-6 bg-muted rounded w-1/3"></div>
                <div className="h-32 bg-muted rounded"></div>
                <div className="flex justify-end gap-2">
                  <div className="h-8 bg-muted rounded w-20"></div>
                  <div className="h-8 bg-muted rounded w-20"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {drafts && (
        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
          {drafts.map((draftContent, index) => (
            <DraftCard
              key={index}
              draftNumber={index + 1}
              initialContent={draftContent}
              onContentChange={(newContent) => handleDraftContentChange(index, newContent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
