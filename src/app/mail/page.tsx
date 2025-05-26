
"use client";

import { useState, useEffect, useTransition } from "react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Email, EmailBoxType } from "@/types/mail";
import { fetchEmails, sendEmail, markEmailAsRead as apiMarkEmailAsRead } from "@/services/gmail"; // Mocked service
import { handleGenerateEmailDrafts, handleRegenerateEmailDrafts } from "@/app/actions";
import type { GenerateEmailDraftsInput } from "@/ai/flows/generate-email-drafts";

import { MailSidebar } from "./components/mail-sidebar";
import { EmailList } from "./components/email-list";
import { EmailDetailView } from "./components/email-detail-view";
import { DraftSummaryCard } from "./components/draft-summary-card";
import { MainReplyComposer } from "./components/main-reply-composer";
import { ChatView } from "./components/chat-view"; // Keep ChatView as per original layout
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Initial context - in a real app, this might be fetched or stored globally
const initialUserContext = "I am a busy professional. I prefer concise and direct communication. Today is " + new Date().toLocaleDateString() + ".";

export default function MailPage() {
  const [currentEmailBox, setCurrentEmailBox] = useState<EmailBoxType | "all">("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [generatedDrafts, setGeneratedDrafts] = useState<string[]>([]);
  const [activeReplyContent, setActiveReplyContent] = useState("");
  const [userContextForAI, setUserContextForAI] = useState(initialUserContext);

  const [isLoadingEmails, startEmailLoadingTransition] = useTransition();
  const [isGeneratingDrafts, startDraftGenerationTransition] = useTransition();
  const [isRegenerating, startRegenerationTransition] = useTransition();
  const [isSendingReply, startSendingTransition] = useTransition();

  const { toast } = useToast();

  useEffect(() => {
    loadEmails(currentEmailBox);
  }, [currentEmailBox]);

  const loadEmails = (boxType: EmailBoxType | "all") => {
    startEmailLoadingTransition(async () => {
      setSelectedEmail(null); // Reset selection when changing box
      setGeneratedDrafts([]);
      setActiveReplyContent("");
      try {
        // For "all", we just use "inbox" from mock service
        const fetchedEmails = await fetchEmails(boxType === "all" ? "inbox" : boxType); 
        setEmails(fetchedEmails);
      } catch (error) {
        toast({ title: "Error", description: "Failed to load emails.", variant: "destructive" });
        setEmails([]);
      }
    });
  };

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    setGeneratedDrafts([]);
    setActiveReplyContent("");
    if (!email.read) {
      await apiMarkEmailAsRead(email.id);
      // Optimistically update read status or re-fetch
      setEmails(prev => prev.map(e => e.id === email.id ? {...e, read: true} : e));
    }
  };

  const handleGenerateInitialDrafts = () => {
    if (!selectedEmail) return;
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
    if (!selectedEmail) return;
    startRegenerationTransition(async () => {
      const input: GenerateEmailDraftsInput = { emailContent: selectedEmail.body, userContext: userContextForAI };
      const result = await handleRegenerateEmailDrafts(input); // Uses the same input type as generate
       if ("error" in result || !result.draftReplies) {
        toast({ title: "Error Regenerating Drafts", description: (result as any).error || "Failed to regenerate drafts.", variant: "destructive" });
        // Optionally update generatedDrafts with error messages or keep old ones
        const errorDrafts = (result.draftReplies as [string,string,string]) || generatedDrafts.map(() => "Error regenerating.") as [string,string,string];
        setGeneratedDrafts(errorDrafts.slice(0,3)); // Ensure it's 3
      } else {
        setGeneratedDrafts(result.draftReplies.slice(0,3) as [string, string, string]); // Ensure it's 3 drafts
        toast({ title: "Drafts Regenerated", description: "Successfully regenerated 3 email drafts." });
        // Optionally, select the first new draft for the composer
        if (result.draftReplies.length > 0) {
          setActiveReplyContent(result.draftReplies[0]);
        }
      }
    });
  };

  const handleSendReply = () => {
    if (!selectedEmail || !activeReplyContent.trim()) return;
    startSendingTransition(async () => {
      try {
        await sendEmail(selectedEmail.senderEmail, `Re: ${selectedEmail.subject}`, activeReplyContent, selectedEmail.id);
        toast({ title: "Email Sent (Mock)", description: "Your reply has been sent." });
        setActiveReplyContent("");
        setGeneratedDrafts([]);
        setSelectedEmail(null); // Go back to list or handle next step
        loadEmails(currentEmailBox); // Refresh email list
      } catch (error) {
        toast({ title: "Error Sending Email", description: "Failed to send the reply.", variant: "destructive" });
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

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mail Assistant</h1>
        <p className="text-muted-foreground">
          Craft thoughtful email replies with the help of AI. (Gmail API is currently mocked)
        </p>
      </div>
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[240px_minmax(300px,1fr)_400px] gap-6 flex-grow min-h-0">
        {/* Mail Sidebar */}
        <div className="hidden md:block">
           <MailSidebar onSelectBox={setCurrentEmailBox} activeBox={currentEmailBox} />
        </div>

        {/* Email List */}
        <div className="min-h-[400px] md:min-h-0">
          <EmailList
            emails={emails}
            onSelectEmail={handleSelectEmail}
            selectedEmailId={selectedEmail?.id}
            isLoading={isLoadingEmails}
            title={getEmailBoxTitle()}
          />
        </div>

        {/* Main Content Area: Email Detail / Drafts / Composer & Chat */}
        <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2"> {/* Ensure this column can scroll if content overflows */}
           {!selectedEmail && (
             <Card className="shadow-md h-full flex items-center justify-center">
               <CardContent className="p-6 text-center text-muted-foreground">
                 <p>Select an email from the list to view its content and generate replies.</p>
               </CardContent>
             </Card>
           )}

          {selectedEmail && (
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

          {(selectedEmail || activeReplyContent) && ( // Show composer if email selected (for context) or if reply started
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
        
        {/* Chat View - kept in the layout as per original design for lg screens */}
         <div className="hidden lg:block lg:col-start-3 min-h-[600px]">
           <ChatView />
         </div>
      </div>
    </div>
  );
}
