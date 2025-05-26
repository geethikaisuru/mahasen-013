
"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import type { Email } from "@/types/mail";
import { getEmailById, sendEmail, markEmailAsRead as apiMarkEmailAsRead } from "@/services/gmail";
import { handleGenerateEmailDrafts, handleRegenerateEmailDrafts } from "@/app/actions";
import type { GenerateEmailDraftsInput } from "@/ai/flows/generate-email-drafts";
import { useAuth } from "@/contexts/auth-context";

import { EmailDetailView } from "../components/email-detail-view";
import { DraftSummaryCard } from "../components/draft-summary-card";
import { MainReplyComposer } from "../components/main-reply-composer";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, AlertTriangle, Mail as MailIcon, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const initialUserContext = "I am a busy professional. I prefer concise and direct communication. Today is " + new Date().toLocaleDateString() + ".";

export default function EmailDetailPage() {
  const { currentUser, googleAccessToken, loading: authLoading, handleSignIn } = useAuth();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const emailId = params.emailId as string;

  const [emailDetails, setEmailDetails] = useState<Email | null>(null);
  const [isFetchingEmail, setIsFetchingEmail] = useState(true);
  const [generatedDrafts, setGeneratedDrafts] = useState<string[]>([]);
  const [activeReplyContent, setActiveReplyContent] = useState("");
  const [userContextForAI, setUserContextForAI] = useState(initialUserContext);

  const [isGeneratingDrafts, startDraftGenerationTransition] = useTransition();
  const [isRegenerating, startRegenerationTransition] = useTransition();
  const [isSendingReply, startSendingTransition] = useTransition();

  const fetchAndSetEmailDetails = useCallback(async () => {
    if (!emailId || !googleAccessToken) {
      if (!authLoading && currentUser && !googleAccessToken) {
        // Message is shown by main conditional rendering
      }
      setIsFetchingEmail(false);
      return;
    }

    setIsFetchingEmail(true);
    try {
      const fetchedEmail = await getEmailById(googleAccessToken, emailId);
      if (fetchedEmail) {
        setEmailDetails(fetchedEmail);
        if (!fetchedEmail.read) {
          await apiMarkEmailAsRead(googleAccessToken, emailId);
        }
      } else {
        toast({ title: "Error", description: "Could not fetch email details.", variant: "destructive" });
        setEmailDetails(null);
      }
    } catch (error) {
      toast({ title: "Error Fetching Email", description: (error as Error).message, variant: "destructive" });
      setEmailDetails(null);
    } finally {
      setIsFetchingEmail(false);
    }
  }, [emailId, googleAccessToken, toast, authLoading, currentUser]);

  useEffect(() => {
    if (currentUser && googleAccessToken) {
        fetchAndSetEmailDetails();
    } else if (!authLoading && currentUser && !googleAccessToken) {
        setIsFetchingEmail(false); // Stop loading if token is missing
    }
  }, [fetchAndSetEmailDetails, currentUser, googleAccessToken, authLoading]);

  const handleGenerateInitialDrafts = () => {
    if (!emailDetails || !emailDetails.body) {
      toast({ title: "Error", description: "Email content not fully loaded or empty.", variant: "destructive" });
      return;
    }
    startDraftGenerationTransition(async () => {
      const input: GenerateEmailDraftsInput = { emailContent: emailDetails.body, userContext: userContextForAI };
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
    if (!emailDetails || !emailDetails.body) {
       toast({ title: "Error", description: "Original email content not fully loaded or empty.", variant: "destructive" });
      return;
    }
    startRegenerationTransition(async () => {
      const input: GenerateEmailDraftsInput = { emailContent: emailDetails.body, userContext: userContextForAI };
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
    if (!emailDetails || !activeReplyContent.trim() || !googleAccessToken) {
      toast({ title: "Error", description: "Cannot send reply. Check login, email selection, or content.", variant: "destructive" });
      return;
    }
    startSendingTransition(async () => {
      try {
        await sendEmail(
          googleAccessToken,
          emailDetails.senderEmail,
          `Re: ${emailDetails.subject}`,
          activeReplyContent
        );
        toast({ title: "Email Sent", description: "Your reply has been sent via Gmail." });
        setActiveReplyContent("");
        setGeneratedDrafts([]);
      } catch (error) {
        toast({ title: "Error Sending Email", description: (error as Error).message || "Failed to send the reply.", variant: "destructive" });
      }
    });
  };

  if (authLoading || (isFetchingEmail && googleAccessToken)) { // Only show main loader if actively fetching with a token
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading email details...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <MailIcon className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6">Please sign in to view email details.</p>
        <Button onClick={handleSignIn}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Sign In & Connect Google
        </Button>
      </div>
    );
  }

  if (!googleAccessToken && currentUser) { // Firebase user exists, but Google token missing
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Google Connection Required</h2>
        <p className="text-muted-foreground mb-4">
          Hello {currentUser.displayName || currentUser.email}, we couldn't retrieve the necessary Google Access Token.
        </p>
        <p className="text-muted-foreground mb-6">Please connect to your Google account to view this email.</p>
        <Button onClick={handleSignIn}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Connect to Google
        </Button>
        <Button onClick={() => router.push('/mail')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Mailbox
        </Button>
      </div>
    );
  }

  if (!isFetchingEmail && !emailDetails && googleAccessToken) { // Token exists, tried fetching, but no email found
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Email Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested email (ID: {emailId}) could not be loaded or does not exist.</p>
        <Button onClick={() => router.push('/mail')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Mailbox
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
      <Button onClick={() => router.push('/mail')} variant="outline" className="self-start">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Mailbox
      </Button>
      <Separator />

      {/* Main content wrapper to control overflow */}
      <div className="w-full overflow-x-hidden"> {/* Ensures this container doesn't cause page scroll */}
        {emailDetails && (
          <>
            <EmailDetailView
              email={emailDetails}
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
        )}
      </div>
    </div>
  );
}

    