
import type { Email, EmailBoxType } from '@/types/mail';
import { formatDistanceToNowStrict } from 'date-fns';

const GMAIL_API_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: GmailHeader[];
  body: {
    attachmentId?: string;
    size: number;
    data?: string; // base64url encoded
  };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string; // Unix timestamp ms
  payload?: GmailMessagePart;
  sizeEstimate?: number;
  raw?: string; // base64url encoded
}

async function makeGmailApiCall<T>(
  endpoint: string,
  accessToken: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<T> {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${GMAIL_API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown API error' }));
    console.error('Gmail API Error:', response.status, errorData);
    throw new Error(errorData.error?.message || `Gmail API request failed: ${response.status}`);
  }
  return response.json() as T;
}

function getHeader(headers: GmailHeader[], name: string): string | undefined {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

function parseMessageBody(payload?: GmailMessagePart): string {
  if (!payload) return '';

  let body = '';
  const mimeType = payload.mimeType;

  if (mimeType === 'text/plain' && payload.body?.data) {
    body = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  } else if (mimeType === 'text/html' && payload.body?.data) {
    // For simplicity, we'll prefer plain text. If only HTML, decode it.
    // A real app might sanitize HTML or use an iframe.
    body = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
     // Basic HTML to text conversion
    const htmlContent = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    if (typeof DOMParser !== 'undefined') { // Check if DOMParser is available (browser environment)
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, "text/html");
            body = doc.body.textContent || "";
        } catch (e) {
            console.warn("DOMParser failed to parse HTML, falling back to raw HTML.", e);
            body = htmlContent; // Fallback to raw HTML if parsing fails
        }
    } else { // Fallback for non-browser environments or if DOMParser is unavailable
        console.warn("DOMParser not available, falling back to raw HTML for email body.");
        body = htmlContent;
    }


  } else if (payload.parts && payload.parts.length > 0) {
    // Look for text/plain part first
    const plainPart = payload.parts.find(part => part.mimeType === 'text/plain');
    if (plainPart && plainPart.body?.data) {
      body = Buffer.from(plainPart.body.data, 'base64url').toString('utf-8');
    } else {
      // If no plain text, look for text/html (recursive call for nested parts)
      const htmlPart = payload.parts.find(part => part.mimeType === 'text/html');
      if (htmlPart) {
        body = parseMessageBody(htmlPart); // Recursive call
      } else {
        // Fallback: try to find *any* part that might contain text, or recursively search deeper
        for (const part of payload.parts) {
            const nestedBody = parseMessageBody(part);
            if (nestedBody) {
                body = nestedBody;
                break;
            }
        }
      }
    }
  }
  return body.replace(/\r\n/g, '\n').trim(); // Normalize line endings
}


function mapGmailMessageToEmail(message: GmailMessage, isFullMessage = false): Email {
  const headers = message.payload?.headers || [];
  const fromHeader = getHeader(headers, 'From') || 'Unknown Sender';
  const senderMatch = fromHeader.match(/(.*)<(.*)>/);
  const senderName = senderMatch ? senderMatch[1].trim() : fromHeader;
  const senderEmail = senderMatch ? senderMatch[2].trim() : 'unknown@example.com';

  const receivedTime = message.internalDate
    ? formatDistanceToNowStrict(new Date(parseInt(message.internalDate, 10)), { addSuffix: true })
    : 'Unknown time';

  return {
    id: message.id,
    sender: senderName,
    senderEmail: senderEmail,
    subject: getHeader(headers, 'Subject') || '(No Subject)',
    snippet: message.snippet || '',
    body: isFullMessage ? parseMessageBody(message.payload) : (message.snippet || ''), // Full body only if requested
    receivedTime: receivedTime,
    read: !(message.labelIds?.includes('UNREAD') ?? true),
  };
}


export async function fetchEmails(accessToken: string, boxType: EmailBoxType, maxResults = 20): Promise<Email[]> {
  let labelIds: string[];
  switch (boxType) {
    case 'inbox':
      labelIds = ['INBOX'];
      break;
    case 'unread':
      labelIds = ['INBOX', 'UNREAD'];
      break;
    case 'sent':
      labelIds = ['SENT'];
      break;
    case 'drafts':
      labelIds = ['DRAFT']; // Note: Drafts API is slightly different. This might need more work.
      break;
    default:
      labelIds = ['INBOX'];
  }

  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    labelIds: labelIds.join(','),
    // Using metadata format to get headers and snippet quickly
    format: 'metadata', 
    fields: 'messages(id,snippet,internalDate,labelIds,payload/headers)', 
  });

  const listResponse = await makeGmailApiCall<{ messages?: GmailMessage[], nextPageToken?: string }>(
    `/messages?${params.toString()}`,
    accessToken
  );

  if (!listResponse.messages) {
    return [];
  }
  
  // The listResponse for format=metadata ALREADY contains snippet and headers.
  // No need for individual fetches unless we need the full body for each list item,
  // which would be slow. We will fetch full body on demand (when email is selected).
  return listResponse.messages.map(msg => mapGmailMessageToEmail(msg, false));
}

export async function getEmailById(accessToken: string, id: string): Promise<Email | null> {
  try {
    const message = await makeGmailApiCall<GmailMessage>(
      `/messages/${id}?format=full`, // format=full to get body
      accessToken
    );
    return mapGmailMessageToEmail(message, true); // true to parse full body
  } catch (error) {
    console.error(`Error fetching email ${id}:`, error);
    return null;
  }
}

export async function markEmailAsRead(accessToken: string, id: string): Promise<void> {
  await makeGmailApiCall(
    `/messages/${id}/modify`,
    accessToken,
    'POST',
    { removeLabelIds: ['UNREAD'] }
  );
}

export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string, // Message-ID of the email being replied to
  references?: string // References header string
): Promise<{ id: string; threadId: string }> {
  
  // Constructing the raw email (RFC 2822 format)
  // This is a simplified version. Real email construction can be more complex (MIME types, attachments, etc.)
  let rawEmail = `From: me\r\n`; // 'me' will be resolved by Gmail API to the authenticated user
  rawEmail += `To: ${to}\r\n`;
  rawEmail += `Subject: ${subject}\r\n`;
  if (inReplyTo) {
    rawEmail += `In-Reply-To: ${inReplyTo}\r\n`;
  }
  if (references) {
    rawEmail += `References: ${references}\r\n`;
  }
  rawEmail += `Content-Type: text/plain; charset="UTF-8"\r\n`;
  rawEmail += `Content-Transfer-Encoding: base64\r\n\r\n`; // Note: Gmail API expects base64 for raw, but content itself is base64 encoded here

  const emailBodyBase64 = Buffer.from(body).toString('base64');
  rawEmail += emailBodyBase64;

  // The Gmail API expects the entire raw email to be base64url encoded.
  const base64UrlEncodedEmail = Buffer.from(rawEmail).toString('base64url');

  const response = await makeGmailApiCall<{ id: string; threadId: string }>(
    `/messages/send`,
    accessToken,
    'POST',
    { raw: base64UrlEncodedEmail }
  );
  return response;
}
