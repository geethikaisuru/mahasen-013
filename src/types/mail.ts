
export interface Email {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  snippet: string; 
  receivedTime: string;
  read?: boolean;
}

export type EmailBoxType = "inbox" | "unread" | "sent" | "drafts";
