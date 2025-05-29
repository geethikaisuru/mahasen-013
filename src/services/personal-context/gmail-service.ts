import type { 
  EmailThread, 
  ThreadMessage, 
  PersonalContextLearningInput 
} from '@/types/personal-context';

export interface GmailThreadsResponse {
  threads: EmailThread[];
  totalThreads: number;
  hasMoreThreads: boolean;
  nextPageToken?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    parts?: Array<{
      mimeType: string;
      body: { data?: string; size: number };
      parts?: any[];
    }>;
    body: { data?: string; size: number };
    mimeType: string;
  };
  internalDate: string;
}

export interface GmailThread {
  id: string;
  messages: GmailMessage[];
  snippet: string;
}

export class GmailService {
  private static instance: GmailService;
  
  private constructor() {}
  
  public static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  /**
   * Fetches email threads where the user has participated (sent at least one reply)
   */
  async fetchInteractiveThreads(
    accessToken: string, 
    userEmail: string, 
    options: PersonalContextLearningInput['options']
  ): Promise<GmailThreadsResponse> {
    try {
      console.log(`[GmailService] Starting thread discovery for ${userEmail}`);
      
      const timeFilter = this.getTimeFilter(options.timeRange);
      
      // First, get threads where user has sent messages
      const sentThreadIds = await this.getUserSentThreadIds(accessToken, userEmail, timeFilter);
      console.log(`[GmailService] Found ${sentThreadIds.length} threads with user participation`);
      
      // Then fetch full thread details for each
      const threads: EmailThread[] = [];
      const batchSize = 10; // Process threads in batches to avoid rate limits
      
      for (let i = 0; i < sentThreadIds.length; i += batchSize) {
        const batch = sentThreadIds.slice(i, i + batchSize);
        const batchThreads = await this.fetchThreadBatch(accessToken, userEmail, batch, options);
        threads.push(...batchThreads);
        
        // Small delay to respect rate limits
        if (i + batchSize < sentThreadIds.length) {
          await this.delay(100);
        }
      }
      
      console.log(`[GmailService] Successfully processed ${threads.length} interactive threads`);
      
      return {
        threads,
        totalThreads: threads.length,
        hasMoreThreads: false
      };
    } catch (error) {
      console.error('[GmailService] Error fetching interactive threads:', error);
      throw new Error(`Failed to fetch Gmail threads: ${(error as Error).message}`);
    }
  }

  /**
   * Gets thread IDs where the user has sent messages
   */
  private async getUserSentThreadIds(
    accessToken: string, 
    userEmail: string, 
    timeFilter: string
  ): Promise<string[]> {
    try {
      let query = `from:${userEmail} ${timeFilter}`;
      
      // Exclude automated messages and promotions
      query += ' -category:promotions -category:social -category:updates';
      query += ' -from:noreply -from:no-reply -from:donotreply';
      
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const threadIds = new Set<string>();
      
      if (data.messages) {
        for (const message of data.messages) {
          threadIds.add(message.threadId);
        }
      }
      
      return Array.from(threadIds);
    } catch (error) {
      console.error('[GmailService] Error getting user sent thread IDs:', error);
      throw error;
    }
  }

  /**
   * Fetches a batch of thread details
   */
  private async fetchThreadBatch(
    accessToken: string,
    userEmail: string,
    threadIds: string[],
    options: PersonalContextLearningInput['options']
  ): Promise<EmailThread[]> {
    const threads: EmailThread[] = [];
    
    for (const threadId of threadIds) {
      try {
        const thread = await this.fetchSingleThread(accessToken, userEmail, threadId, options);
        if (thread) {
          threads.push(thread);
        }
      } catch (error) {
        console.warn(`[GmailService] Failed to fetch thread ${threadId}:`, error);
        // Continue with other threads
      }
    }
    
    return threads;
  }

  /**
   * Fetches a single thread with all messages
   */
  private async fetchSingleThread(
    accessToken: string,
    userEmail: string,
    threadId: string,
    options: PersonalContextLearningInput['options']
  ): Promise<EmailThread | null> {
    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
      }

      const gmailThread: GmailThread = await response.json();
      
      // Filter out threads that are too short
      if (gmailThread.messages.length < options.minThreadLength) {
        return null;
      }
      
      // Check if user actually participated in conversation
      const userParticipation = this.checkUserParticipation(gmailThread.messages, userEmail);
      if (!userParticipation.hasParticipated || !userParticipation.hasReplied) {
        return null;
      }
      
      // Convert to our EmailThread format
      const thread = await this.convertGmailThread(gmailThread, userEmail);
      
      // Filter promotional or automated content
      if (!options.includePromotional && this.isPromotionalThread(thread)) {
        return null;
      }
      
      return thread;
    } catch (error) {
      console.error(`[GmailService] Error fetching single thread ${threadId}:`, error);
      return null;
    }
  }

  /**
   * Converts Gmail thread format to our internal format
   */
  private async convertGmailThread(gmailThread: GmailThread, userEmail: string): Promise<EmailThread> {
    const messages: ThreadMessage[] = [];
    const participants = new Set<string>();
    
    for (const gmailMessage of gmailThread.messages) {
      const message = await this.convertGmailMessage(gmailMessage, userEmail);
      messages.push(message);
      
      participants.add(message.from);
      message.to.forEach(email => participants.add(email));
    }
    
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    
    return {
      threadId: gmailThread.id,
      subject: firstMessage.subject,
      participants: Array.from(participants),
      messageCount: messages.length,
      userParticipation: true, // Already filtered for this
      firstMessageDate: firstMessage.timestamp,
      lastMessageDate: lastMessage.timestamp,
      messages,
      threadCategory: this.categorizeThread(messages, userEmail)
    };
  }

  /**
   * Converts Gmail message format to our internal format
   */
  private async convertGmailMessage(gmailMessage: GmailMessage, userEmail: string): Promise<ThreadMessage> {
    const headers = gmailMessage.payload.headers;
    const from = this.getHeaderValue(headers, 'From');
    const to = this.getHeaderValue(headers, 'To');
    const cc = this.getHeaderValue(headers, 'Cc');
    const bcc = this.getHeaderValue(headers, 'Bcc');
    const subject = this.getHeaderValue(headers, 'Subject');
    
    const body = await this.extractMessageBody(gmailMessage.payload);
    
    const headerMap: Record<string, string> = {};
    headers.forEach(header => {
      headerMap[header.name.toLowerCase()] = header.value;
    });
    
    return {
      messageId: gmailMessage.id,
      from: this.extractEmailAddress(from),
      to: this.parseEmailList(to),
      cc: cc ? this.parseEmailList(cc) : undefined,
      bcc: bcc ? this.parseEmailList(bcc) : undefined,
      subject: subject || '',
      body: body || '',
      timestamp: new Date(parseInt(gmailMessage.internalDate)),
      isFromUser: this.extractEmailAddress(from).toLowerCase() === userEmail.toLowerCase(),
      headers: headerMap
    };
  }

  /**
   * Extracts message body from Gmail payload
   */
  private async extractMessageBody(payload: GmailMessage['payload']): Promise<string> {
    try {
      // Try to get plain text first
      let body = '';
      
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body.data) {
            body = this.decodeBase64Url(part.body.data);
            break;
          }
        }
        
        // If no plain text, try HTML
        if (!body) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body.data) {
              body = this.stripHtml(this.decodeBase64Url(part.body.data));
              break;
            }
          }
        }
      } else if (payload.body.data) {
        body = this.decodeBase64Url(payload.body.data);
        if (payload.mimeType === 'text/html') {
          body = this.stripHtml(body);
        }
      }
      
      return body.trim();
    } catch (error) {
      console.warn('[GmailService] Error extracting message body:', error);
      return '';
    }
  }

  /**
   * Utility functions
   */
  private getHeaderValue(headers: { name: string; value: string }[], name: string): string {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  }

  private extractEmailAddress(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString.trim();
  }

  private parseEmailList(emailString: string): string[] {
    if (!emailString) return [];
    return emailString.split(',').map(email => this.extractEmailAddress(email.trim()));
  }

  private decodeBase64Url(data: string): string {
    try {
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      return atob(base64);
    } catch (error) {
      console.warn('[GmailService] Error decoding base64:', error);
      return '';
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  private checkUserParticipation(messages: GmailMessage[], userEmail: string): { hasParticipated: boolean; hasReplied: boolean } {
    let hasParticipated = false;
    let hasReplied = false;
    let foundNonUserMessage = false;
    
    for (const message of messages) {
      const from = this.extractEmailAddress(this.getHeaderValue(message.payload.headers, 'From'));
      const isFromUser = from.toLowerCase() === userEmail.toLowerCase();
      
      if (isFromUser) {
        hasParticipated = true;
        // If we've seen a non-user message before this, then this is a reply
        if (foundNonUserMessage) {
          hasReplied = true;
        }
      } else {
        foundNonUserMessage = true;
      }
    }
    
    return { hasParticipated, hasReplied };
  }

  private categorizeThread(messages: ThreadMessage[], userEmail: string): EmailThread['threadCategory'] {
    // Simple categorization based on patterns
    const subject = messages[0]?.subject.toLowerCase() || '';
    const participants = new Set(messages.map(m => m.from));
    
    // Check for work-related keywords
    const workKeywords = ['meeting', 'project', 'deadline', 'report', 'team', 'client', 'proposal'];
    if (workKeywords.some(keyword => subject.includes(keyword))) {
      return 'work';
    }
    
    // Check for automated messages
    const automatedKeywords = ['notification', 'automated', 'noreply', 'alert', 'update'];
    if (automatedKeywords.some(keyword => subject.includes(keyword))) {
      return 'automated';
    }
    
    // Check for commercial messages
    const commercialKeywords = ['order', 'purchase', 'invoice', 'payment', 'shipping'];
    if (commercialKeywords.some(keyword => subject.includes(keyword))) {
      return 'commercial';
    }
    
    // Default to personal or unknown
    return participants.size <= 3 ? 'personal' : 'unknown';
  }

  private isPromotionalThread(thread: EmailThread): boolean {
    const subject = thread.subject.toLowerCase();
    const promotionalKeywords = [
      'sale', 'offer', 'discount', 'promotion', 'deal', 'limited time',
      'newsletter', 'unsubscribe', 'marketing', 'advertisement'
    ];
    
    return promotionalKeywords.some(keyword => subject.includes(keyword));
  }

  private getTimeFilter(timeRange: PersonalContextLearningInput['options']['timeRange']): string {
    const now = new Date();
    let date: Date;
    
    switch (timeRange) {
      case 'last_month':
        date = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'last_3months':
        date = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'last_6months':
        date = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case 'last_year':
        date = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        date = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    }
    
    return `after:${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test connection to Gmail API
   */
  async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('[GmailService] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get user's Gmail profile information
   */
  async getUserProfile(accessToken: string): Promise<{ emailAddress: string; threadsTotal: number } | null> {
    try {
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
      }

      const profile = await response.json();
      return {
        emailAddress: profile.emailAddress,
        threadsTotal: profile.threadsTotal
      };
    } catch (error) {
      console.error('[GmailService] Error getting user profile:', error);
      return null;
    }
  }
}

export const gmailService = GmailService.getInstance(); 