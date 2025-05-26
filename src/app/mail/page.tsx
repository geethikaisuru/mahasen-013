
"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation"; // Added for navigation
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Email, EmailBoxType } from "@/types/mail";
import { fetchEmails, markEmailAsRead as apiMarkEmailAsRead } from "@/services/gmail";
import { useAuth } from "@/contexts/auth-context";

import { MailSidebar } from "./components/mail-sidebar";
import { EmailList } from "./components/email-list";
import { ChatView } from "./components/chat-view";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, Mail as MailIcon } from "lucide-react";

export default function MailListPage() {
  const { currentUser, googleAccessToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [currentEmailBox, setCurrentEmailBox] = useState<EmailBoxType | "all">("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoadingEmails, startEmailLoadingTransition] = useTransition();
  const [lastSelectedEmailId, setLastSelectedEmailId] = useState<string | null>(null);


  const loadEmails = useCallback((boxType: EmailBoxType | "all") => {
    if (!googleAccessToken) {
      setEmails([]);
      if (!authLoading && currentUser) {
         console.warn("MailPage: loadEmails called but no googleAccessToken. User:", currentUser.email);
         toast({ title: "Authentication Issue", description: "Missing Google Access Token for Gmail. Please try signing out and in.", variant: "destructive" });
      }
      return;
    }
    console.log(`MailPage: Loading emails for ${boxType} with token ${googleAccessToken.substring(0,10)}...`);
    startEmailLoadingTransition(async () => {
      try {
        const fetchedEmails = await fetchEmails(googleAccessToken, boxType === "all" ? "inbox" : boxType);
        setEmails(fetchedEmails);
      } catch (error) {
        toast({ title: "Error Loading Emails", description: (error as Error).message || "Failed to load emails.", variant: "destructive" });
        setEmails([]);
      }
    });
  }, [googleAccessToken, toast, authLoading, currentUser]);

  useEffect(() => {
    if (currentUser && googleAccessToken) {
      loadEmails(currentEmailBox);
    } else if (!authLoading && !currentUser) {
      setEmails([]);
    }
  }, [currentEmailBox, currentUser, googleAccessToken, loadEmails, authLoading]);

  const handleSelectEmail = async (email: Email) => {
    setLastSelectedEmailId(email.id);
    router.push(`/mail/${email.id}`);
    // Mark as read optimistically in the list, full update might happen on detail page or background
    if (!email.read && googleAccessToken) {
        try {
            await apiMarkEmailAsRead(googleAccessToken, email.id);
            setEmails(prev => prev.map(e => e.id === email.id ? {...e, read: true} : e));
        } catch (error) {
            console.warn("Failed to mark email as read from list view:", error);
            // Don't toast here, as it might be too noisy. Detail page can handle errors more gracefully.
        }
    }
  };

  const getEmailBoxTitle = () => {
    const titles: Record<EmailBoxType | "all", string> = {
      inbox: "Inbox",
      unread: "Unread Emails",
      sent: "Sent Emails",
      drafts: "Drafts",
      all: "All Mail"
    };
    return titles[currentEmailBox];
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading authentication...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <MailIcon className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Welcome to Mail Assistant</h2>
        <p className="text-muted-foreground mb-6">Please sign in with your Google account to access your emails and use AI features.</p>
        <p className="text-sm text-muted-foreground">If you don't see a sign-in option, check the top-right corner or sidebar.</p>
      </div>
    );
  }

  if (!googleAccessToken && currentUser) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Authentication Token Missing</h2>
        <p className="text-muted-foreground mb-4">
          Hello {currentUser.displayName || currentUser.email}, we couldn't retrieve the necessary Google Access Token after sign-in.
        </p>
        <p className="text-muted-foreground mb-6">Try signing out and signing back in. Ensure you grant all requested permissions.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mail Assistant</h1>
        <p className="text-muted-foreground">
          View your Gmail inbox and craft replies with AI.
        </p>
      </div>
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[240px_minmax(300px,1fr)_400px] gap-6 flex-grow min-h-0">
        <div className="hidden md:block">
           <MailSidebar onSelectBox={setCurrentEmailBox} activeBox={currentEmailBox} />
        </div>

        <div className="min-h-[400px] md:min-h-0">
          <EmailList
            emails={emails}
            onSelectEmail={handleSelectEmail}
            selectedEmailId={lastSelectedEmailId} // Keep track of last selected for styling
            isLoading={isLoadingEmails}
            title={getEmailBoxTitle()}
          />
        </div>

        {/* Placeholder for the content that used to be here, or ChatView */}
        <div className="hidden lg:block lg:col-start-3 min-h-[600px]">
            {/*  This column used to host email details or chat. Now it's primarily for chat on list view. */}
           <ChatView />
        </div>
      </div>
    </div>
  );
}
