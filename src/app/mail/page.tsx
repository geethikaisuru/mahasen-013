
"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Email, EmailBoxType } from "@/types/mail";
import { fetchEmails, sendEmail, markEmailAsRead as apiMarkEmailAsRead, getEmailById } from "@/services/gmail";
import { handleGenerateEmailDrafts, handleRegenerateEmailDrafts } from "@/app/actions";
import type { GenerateEmailDraftsInput } from "@/ai/flows/generate-email-drafts";
import { useAuth } from "@/contexts/auth-context";

import { MailSidebar } from "./components/mail-sidebar";
import { EmailList } from "./components/email-list";
import { EmailDetailView } from "./components/email-detail-view";
import { DraftSummaryCard } from "./components/draft-summary-card";
import { MainReplyComposer } from "./components/main-reply-composer";
import { ChatView } from "./components/chat-view";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, Mail as MailIcon } from "lucide-react"; // Added MailIcon
import { Button } from "@/components/ui/button";


const initialUserContext = "I am a busy professional. I prefer concise and direct communication. Today is " + new Date().toLocaleDateString() + ".";

export default function MailPage() {
  const { currentUser, googleAccessToken, loading: authLoading } = useAuth();
  const [currentEmailBox, setCurrentEmailBox] = useState<EmailBoxType | "all">("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isFetchingFullEmail, setIsFetchingFullEmail] = useState(false);
  const [generatedDrafts, setGeneratedDrafts] = useState<string[]>([]);
  const [activeReplyContent, setActiveReplyContent] = useState("");
  const [userContextForAI, setUserContextForAI] = useState(initialUserContext);

  const [isLoadingEmails, startEmailLoadingTransition] = useTransition();
  const [isGeneratingDrafts, startDraftGenerationTransition] = useTransition();
  const [isRegenerating, startRegenerationTransition] = useTransition();
  const [isSendingReply, startSendingTransition] = useTransition();

  const { toast } = useToast();

  const loadEmails = useCallback((boxType: EmailBoxType | "all") => {
    if (!googleAccessToken) {
      setEmails([]);
      if (!authLoading && currentUser) { 
         console.warn("MailPage: loadEmails called but no googleAccessToken. User:", currentUser.email);
         toast({ title: "Authentication Issue", description: "Missing Google Access Token for Gmail. Please try signing out and in.", variant: "destructive" });
      } else if (!authLoading && !currentUser) {
        // This case is handled by the main page conditional rendering
      }
      return;
    }
    console.log(`MailPage: Loading emails for ${boxType} with token ${googleAccessToken.substring(0,10)}...`);
    startEmailLoadingTransition(async () => {
      setSelectedEmail(null);
      setGeneratedDrafts([]);
      setActiveReplyContent("");
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
      // Clear emails if user logs out
      setEmails([]);
      setSelectedEmail(null);
      setGeneratedDrafts([]);
    }
    // Log current state for debugging token issues
    console.log("MailPage Effect: currentUser:", currentUser?.email, "googleAccessToken:", googleAccessToken ? "present" : "null", "authLoading:", authLoading);

  }, [currentEmailBox, currentUser, googleAccessToken, loadEmails, authLoading]);

  const handleSelectEmail = async (email: Email) => {
    if (!googleAccessToken) {
      toast({ title: "Authentication Issue", description: "Cannot fetch email details. Missing Google Access Token.", variant: "destructive" });
      return;
    }
    setSelectedEmail(email); 
    setGeneratedDrafts([]);
    setActiveReplyContent("");
    setIsFetchingFullEmail(true);

    try {
      const fullEmail = await getEmailById(googleAccessToken, email.id);
      if (fullEmail) {
        setSelectedEmail(fullEmail); 
        if (!fullEmail.read) {
          await apiMarkEmailAsRead(googleAccessToken, email.id);
          setEmails(prev => prev.map(e => e.id === email.id ? {...fullEmail, read: true} : e));
        }
      } else {
        toast({ title: "Error", description: "Could not fetch email details.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Fetching Email", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsFetchingFullEmail(false);
    }
  };

  const handleGenerateInitialDrafts = () => {
    if (!selectedEmail || !selectedEmail.body) { 
      toast({ title: "Error", description: "Email content not fully loaded or empty.", variant: "destructive" });
      return;
    }
    startDraftGenerationTransition(async () => {
      const input: GenerateEmailDraftsInput = { emailContent: selectedEmail.body, userContext: userContextForAI };
      const result = await handleGenerateEmailDrafts(input);
      if ("error" in result || !result.drafts) {
        toast({ title: "Error Generating Drafts", description: (result as any).error || "Failed to generate drafts.", variant: "destructive" });
        setGeneratedDrafts(result.drafts || ["Error generating draft.", "Error generating draft.", "Error generating draft."]);
      } else {
        setGeneratedDrafts(result.drafts as [string, string, string]);
        toast({ title: "Drafts Generated", description: "Successfully generated 3 email drafts." });
      }
    });
  };
  
  const handleUpdateDraftContent = (index: number, newContent: string) => {
    setGeneratedDrafts(prevDrafts => {
      const updatedDrafts = [...prevDrafts];
      updatedDrafts[index] = newContent;
      return updatedDrafts;
    });
  };

  const handleSelectDraftForComposer = (draftContent: string) => {
    setActiveReplyContent(draftContent);
  };

  const handleRegenerateInComposer = () => {
    if (!selectedEmail || !selectedEmail.body) {
       toast({ title: "Error", description: "Original email content not fully loaded or empty.", variant: "destructive" });
      return;
    }
    startRegenerationTransition(async () => {
      const input: GenerateEmailDraftsInput = { emailContent: selectedEmail.body, userContext: userContextForAI };
      const result = await handleRegenerateEmailDrafts(input);
       if ("error" in result || !result.draftReplies) {
        toast({ title: "Error Regenerating Drafts", description: (result as any).error || "Failed to regenerate drafts.", variant: "destructive" });
        const errorDrafts = (result.draftReplies as [string,string,string]) || generatedDrafts.map(() => "Error regenerating.") as [string,string,string];
        setGeneratedDrafts(errorDrafts.slice(0,3));
      } else {
        setGeneratedDrafts(result.draftReplies.slice(0,3) as [string, string, string]);
        toast({ title: "Drafts Regenerated", description: "Successfully regenerated 3 email drafts." });
        if (result.draftReplies.length > 0) {
          setActiveReplyContent(result.draftReplies[0]);
        }
      }
    });
  };

  const handleSendReply = () => {
    if (!selectedEmail || !activeReplyContent.trim() || !googleAccessToken) {
      toast({ title: "Error", description: "Cannot send reply. Check login, email selection, or content.", variant: "destructive" });
      return;
    }
    startSendingTransition(async () => {
      try {
        await sendEmail(googleAccessToken, selectedEmail.senderEmail, `Re: ${selectedEmail.subject}`, activeReplyContent);
        toast({ title: "Email Sent", description: "Your reply has been sent via Gmail." });
        setActiveReplyContent("");
        setGeneratedDrafts([]);
        loadEmails(currentEmailBox); 
      } catch (error) {
        toast({ title: "Error Sending Email", description: (error as Error).message || "Failed to send the reply.", variant: "destructive" });
      }
    });
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
     console.error("MailPage: Rendering 'Authentication Token Missing'. currentUser:", currentUser.email, "googleAccessToken is null.");
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Authentication Token Missing</h2>
        <p className="text-muted-foreground mb-4">
          Hello {currentUser.displayName || currentUser.email}, we couldn't retrieve the necessary Google Access Token after sign-in. 
          This can happen if permissions were not fully granted or due to a temporary issue with Google's authentication service.
        </p>
        <p className="text-muted-foreground mb-2">
          Please check your browser's console (Ctrl+Shift+J or Cmd+Option+J) for any error messages from "UserNav" or "AuthContext".
        </p>
        <p className="text-muted-foreground mb-6">Try signing out and signing back in. Ensure you grant all requested permissions on the Google consent screen.</p>
        <p className="text-xs text-muted-foreground">If the problem persists, verify your Google Cloud Platform project settings (OAuth Consent Screen, Enabled APIs, Credentials) as per the setup guide.</p>
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
            selectedEmailId={selectedEmail?.id}
            isLoading={isLoadingEmails}
            title={getEmailBoxTitle()}
          />
        </div>

        <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2">
           {!selectedEmail && !isLoadingEmails && emails.length > 0 && ( // Show only if emails have loaded but none selected
             <Card className="shadow-md h-full flex items-center justify-center min-h-[300px]">
               <CardContent className="p-6 text-center text-muted-foreground">
                 <p>Select an email from the list to view its content and generate replies.</p>
               </CardContent>
             </Card>
           )}
            {!selectedEmail && !isLoadingEmails && emails.length === 0 && !isLoadingEmails && googleAccessToken && ( // Show if no emails and not loading
             <Card className="shadow-md h-full flex items-center justify-center min-h-[300px]">
               <CardContent className="p-6 text-center text-muted-foreground">
                 <p>Your "{getEmailBoxTitle()}" box is empty or couldn't be loaded.</p>
               </CardContent>
             </Card>
           )}
           {isFetchingFullEmail && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading email content...</p>
              </div>
            )}

          {selectedEmail && !isFetchingFullEmail && (
            <EmailDetailView
              email={selectedEmail}
              onGenerateDrafts={handleGenerateInitialDrafts}
              isGeneratingDrafts={isGeneratingDrafts}
            />
          )}

          {isGeneratingDrafts && generatedDrafts.length === 0 && (
             <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="shadow-md animate-pulse">
                    <CardContent className="p-6 space-y-3">
                      <div className="h-5 bg-muted rounded w-1/3"></div>
                      <div className="h-20 bg-muted rounded"></div>
                      <div className="flex justify-end gap-2 mt-2">
                        <div className="h-8 bg-muted rounded w-24"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
          )}
          
          {generatedDrafts.length > 0 && (
            <div className="mt-6 space-y-4">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Suggested Drafts</h2>
              <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
                {generatedDrafts.map((draft, index) => (
                  <DraftSummaryCard
                    key={index}
                    draftNumber={index + 1}
                    content={draft}
                    onSelectDraft={handleSelectDraftForComposer}
                    onUpdateDraftContent={(newContent) => handleUpdateDraftContent(index, newContent)}
                  />
                ))}
              </div>
            </div>
          )}

          {(selectedEmail || activeReplyContent) && !isFetchingFullEmail && (
            <div className="mt-6">
              <MainReplyComposer
                replyContent={activeReplyContent}
                onReplyContentChange={setActiveReplyContent}
                userContext={userContextForAI}
                onUserContextChange={setUserContextForAI}
                onSend={handleSendReply}
                onRegenerate={handleRegenerateInComposer}
                isSending={isSendingReply}
                isRegenerating={isRegenerating}
              />
            </div>
          )}
        </div>
        
         <div className="hidden lg:block lg:col-start-3 min-h-[600px]">
           <ChatView />
         </div>
      </div>
    </div>
  );
}
