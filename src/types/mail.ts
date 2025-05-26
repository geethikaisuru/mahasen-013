
export interface Email {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  body: string; // Will contain full body after fetching details
  snippet: string; 
  receivedTime: string; // Formatted string like "10:30 AM" or "2 days ago"
  read?: boolean;
  // Potentially add raw internalDate if needed for precise sorting later
  // internalDate?: string; // Unix timestamp from Gmail
}

export type EmailBoxType = "inbox" | "unread" | "sent" | "drafts";
