
"use client";

import { Button } from "@/components/ui/button";
import { EmailDisplay } from "./email-display"; 
import type { Email } from "@/types/mail";
import { Loader2, Wand2 } from "lucide-react";

interface EmailDetailViewProps {
  email: Email;
  onGenerateDrafts: () => void;
  isGeneratingDrafts: boolean;
}

export function EmailDetailView({ email, onGenerateDrafts, isGeneratingDrafts }: EmailDetailViewProps) {
  return (
    <div className="space-y-4">
      <EmailDisplay {...email} />
      <div className="flex justify-end">
        <Button onClick={onGenerateDrafts} disabled={isGeneratingDrafts}>
          {isGeneratingDrafts ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Draft Replies
        </Button>
      </div>
    </div>
  );
}
