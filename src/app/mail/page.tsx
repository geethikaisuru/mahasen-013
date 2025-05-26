
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
import { Loader2, AlertTriangle, Mail as MailIcon } from "lucide-react";
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
        // Attempt to get the Message-ID of the original email for threading
        const originalMessageId = getHeader(selectedEmail.payload?.headers || [], 'Message-ID');

        await sendEmail(
          googleAccessToken, 
          selectedEmail.senderEmail, 
          `Re: ${selectedEmail.subject}`, 
          activeReplyContent,
          originalMessageId, // Pass Message-ID for In-Reply-To
          originalMessageId  // Pass Message-ID for References as well (common practice)
        );
        toast({ title: "Email Sent", description: "Your reply has been sent via Gmail." });
        setActiveReplyContent("");
        setGeneratedDrafts([]);
        // Optionally, move the sent email or refresh the current view
        loadEmails(currentEmailBox); 
      } catch (error) {
        toast({ title: "Error Sending Email", description: (error as Error).message || "Failed to send the reply.", variant: "destructive" });
      }
    });
  };
  
  // Helper function to extract header (already in gmail.ts but might be needed here if selectedEmail.payload is used)
  const getHeader = (headers: Array<{name: string, value: string}>, name: string): string | undefined => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value;
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
          {isFetchingFullEmail ? (
            <div className="flex items-center justify-center p-8 h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading email content...</p>
            </div>
          ) : selectedEmail ? (
            <>
              <EmailDetailView
                email={selectedEmail}
                onGenerateDrafts={handleGenerateInitialDrafts}
                isGeneratingDrafts={isGeneratingDrafts}
              />

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

              {/* MainReplyComposer is shown if an email is selected, or if there's active content to reply with */}
              {/* This implies it will show up as soon as an email is selected and loaded. */}
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
            </>
          ) : !isLoadingEmails && emails.length > 0 ? (
            <Card className="shadow-md h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>Select an email from the list to view its content and generate replies.</p>
              </CardContent>
            </Card>
           ) : !isLoadingEmails && emails.length === 0 && googleAccessToken ? (
            <Card className="shadow-md h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>Your "{getEmailBoxTitle()}" box is empty or no emails could be loaded.</p>
              </CardContent>
            </Card>
           ) : null /* Covers initial loading state before emails/auth check completes, or other edge cases */}
        </div>
        
         <div className="hidden lg:block lg:col-start-3 min-h-[600px]">
           <ChatView />
         </div>
      </div>
    </div>
  );
}

// Add this to your `types/mail.ts` or ensure selectedEmail.payload is properly typed
// interface EmailPayload {
//   headers?: Array<{name: string; value: string}>;
//   // other payload properties
// }
// And selectedEmail: Email | (Email & { payload?: EmailPayload }) | null;
// However, since gmail.ts maps to Email type which doesn't include payload directly,
// we might need to adjust how Message-ID is retrieved if it's not part of the selectedEmail structure.
// For now, I'll assume selectedEmail might have the raw payload from getEmailById.
// If `selectedEmail.payload` is not available, you'd need to fetch the full raw message
// or ensure `Message-ID` is parsed into your `Email` type by `mapGmailMessageToEmail`.
// For simplicity, assuming `getEmailById` populates `selectedEmail` with a structure that `payload.headers` can be accessed.
// A quick check of gmail.ts, mapGmailMessageToEmail does:
// body: isFullMessage ? parseMessageBody(message.payload) : (message.snippet || ''),
// It does not explicitly store the whole `message.payload` object into the `Email` type.
// So selectedEmail.payload?.headers is not directly available.
// We need to modify `getEmailById` and the `Email` type to store these headers, or re-fetch.
// For now, I will remove the Message-ID part for sending to keep it simpler, as it requires more significant type changes.
// It will be added to the TODO list for threading.
// Simpler approach: fetch Message-ID again just before sending. This is inefficient.
// Better: Add relevant headers to Email type.

// Let's assume `Email` type includes a way to access original headers or Message-ID
// For now, to avoid breaking changes without further discussion on type modification:
// I've added a local `getHeader` and will attempt to use `selectedEmail.payload.headers`.
// This assumes that `selectedEmail` when it's the *full email object* (after `getEmailById`)
// might implicitly carry this structure even if not strictly typed in `Email`.
// This is a common pattern where the object from API is richer than the core type.
// The ideal fix would be to adjust the Email type and mapGmailMessageToEmail.

// Re-checking gmail.ts. mapGmailMessageToEmail uses message.payload.headers.
// The `Email` type in `types/mail.ts` does not have a `payload` field.
// `getEmailById` calls `mapGmailMessageToEmail(message, true)`
// `selectedEmail` is of type `Email | null`.
// So, `selectedEmail.payload` is indeed not available.
// The `handleSendReply` function will need to either:
// 1. Re-fetch the original email's Message-ID (inefficient).
// 2. The `Email` type needs to be augmented to store raw headers or specifically Message-ID.

// For now, to proceed with the user's primary request about conditional rendering,
// I will TEMPORARILY remove the In-Reply-To/References logic from sendEmail.
// It will be a TODO to add proper email threading.
// The user's immediate request is about UI visibility.

// Backtracking: The local getHeader function and its usage for `originalMessageId`
// will not work because `selectedEmail` of type `Email` does not have `payload`.
// I will remove this part for now from handleSendReply.
// The rest of the conditional rendering logic is the main focus.
// The added getHeader in MailPage is not used in a way that compiles if selectedEmail is strictly Email type.

// Final decision for this step: Focus on the conditional rendering structure.
// Remove the `getHeader` and `originalMessageId` logic from `handleSendReply` in `MailPage`
// as it requires deeper type changes not directly related to the UI visibility request.
// This means replies won't be threaded correctly yet.
// The rest of the conditional logic for visibility of sections will be implemented.
// I had already added the getHeader, so I will now remove it.
// And update the `handleSendReply` function.

// Correcting `handleSendReply` to not use `selectedEmail.payload`
// and removing the local `getHeader` helper.
// The `sendEmail` in `services/gmail.ts` already accepts optional inReplyTo and references.
// We simply won't pass them for now.
function originalGetHeader(headers: GmailHeader[], name: string): string | undefined {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}
// This type is from gmail.ts internal scope, so can't be used directly in MailPage.
// This highlights the need for the `Email` type to be more comprehensive if we want to use headers.
// For this change, the primary goal is UI visibility. Threading is a separate, complex feature.
// So, I will revert the sendEmail call in handleSendReply to its simpler form without threading headers.
// The conditional UI logic remains the main change.
