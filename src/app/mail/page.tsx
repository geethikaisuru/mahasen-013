
"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Email, EmailBoxType } from "@/types/mail";
import { fetchEmails, markEmailAsRead as apiMarkEmailAsRead } from "@/services/gmail";
import { useAuth } from "@/contexts/auth-context";

import { MailSidebar } from "./components/mail-sidebar";
import { EmailList } from "./components/email-list";
// ChatView is no longer imported or used here
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, Mail as MailIcon, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


export default function MailListPage() {
  const { currentUser, googleAccessToken, loading: authLoading, handleSignIn } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [currentEmailBox, setCurrentEmailBox] = useState<EmailBoxType | "all">("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoadingEmails, startEmailLoadingTransition] = useTransition();
  const [lastSelectedEmailId, setLastSelectedEmailId] = useState<string | null>(null);
  const [isMailSidebarExpanded, setIsMailSidebarExpanded] = useState(false);


  const loadEmails = useCallback((boxType: EmailBoxType | "all") => {
    if (!googleAccessToken) {
      setEmails([]);
      if (!authLoading && currentUser) {
         console.warn("MailPage: loadEmails called but no googleAccessToken. User:", currentUser.email);
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
    console.log("MailPage Effect: currentUser:", currentUser?.email, "googleAccessToken:", googleAccessToken ? "present" : "null", "authLoading:", authLoading);
    if (currentUser && googleAccessToken) {
      loadEmails(currentEmailBox);
    } else if (!authLoading && !currentUser) {
      setEmails([]);
    }
  }, [currentEmailBox, currentUser, googleAccessToken, loadEmails, authLoading]);

  const handleSelectEmail = async (email: Email) => {
    if (!googleAccessToken) {
      toast({ title: "Connection Error", description: "Please connect to Google to open emails.", variant: "destructive"});
      return;
    }
    setLastSelectedEmailId(email.id);
    router.push(`/mail/${email.id}`); // Navigate to detail page
    if (!email.read && googleAccessToken) {
        try {
            await apiMarkEmailAsRead(googleAccessToken, email.id);
            setEmails(prev => prev.map(e => e.id === email.id ? {...e, read: true} : e));
        } catch (error) {
            console.warn("Failed to mark email as read from list view:", error);
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
        <Button onClick={handleSignIn}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Sign In & Connect Google
        </Button>
      </div>
    );
  }

  if (!googleAccessToken && currentUser) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Google Connection Required</h2>
        <p className="text-muted-foreground mb-4">
          Hello {currentUser.displayName || currentUser.email}, your Gmail access token is missing or has expired.
        </p>
        <p className="text-muted-foreground mb-6">Please connect to your Google account to access mail features.</p>
        <Button onClick={handleSignIn}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Connect to Google
        </Button>
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

      <div
        className={cn(
          "grid gap-6 flex-grow min-h-0 transition-all duration-300 ease-in-out",
          "grid-cols-[auto_1fr]" // Simplified: always two columns, MailSidebar and EmailList
        )}
        style={{
            gridTemplateColumns: isMailSidebarExpanded
            ? '160px 1fr' // Mail sidebar (expanded) + Email list (takes remaining space)
            : '56px 1fr',  // Mail sidebar (collapsed) + Email list (takes remaining space)
        }}
      >
        <div
          className="min-h-0 transition-all duration-300 ease-in-out"
          style={{ width: isMailSidebarExpanded ? '160px' : '56px' }}
          onMouseEnter={() => setIsMailSidebarExpanded(true)}
          onMouseLeave={() => setIsMailSidebarExpanded(false)}
        >
           <MailSidebar
            onSelectBox={setCurrentEmailBox}
            activeBox={currentEmailBox}
            isExpanded={isMailSidebarExpanded}
           />
        </div>

        <div className="min-h-[400px] md:min-h-0">
          <EmailList
            emails={emails}
            onSelectEmail={handleSelectEmail}
            selectedEmailId={lastSelectedEmailId}
            isLoading={isLoadingEmails}
            title={getEmailBoxTitle()}
          />
        </div>
        {/* ChatView component and its container div have been removed from here */}
      </div>
    </div>
  );
}
