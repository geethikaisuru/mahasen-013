
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

function base64UrlToBase64(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

function parseMessageBody(payload?: GmailMessagePart): string {
  if (!payload) return '';

  let bodyData = '';
  let bodyMimeType = payload.mimeType;

  if (payload.parts && payload.parts.length > 0) {
    let chosenPart = payload.parts.find(part => part.mimeType === 'text/plain');
    if (!chosenPart) {
      chosenPart = payload.parts.find(part => part.mimeType === 'text/html');
    }
    if (!chosenPart) {
        for (const part of payload.parts) {
            const nestedBody = parseMessageBody(part);
            if (nestedBody) return nestedBody; 
        }
        if (payload.body?.data) {
            chosenPart = payload;
        } else {
             return ''; 
        }
    }
    if (chosenPart && chosenPart.body?.data) {
      bodyData = chosenPart.body.data;
      bodyMimeType = chosenPart.mimeType; 
    } else if (payload.body?.data){ 
      bodyData = payload.body.data;
      bodyMimeType = payload.mimeType;
    } else {
      return ''; 
    }
  } else if (payload.body?.data) {
    bodyData = payload.body.data;
  } else {
    return '';
  }

  let decodedBody = '';
  if (bodyData) {
    const standardBase64 = base64UrlToBase64(bodyData);
    decodedBody = Buffer.from(standardBase64, 'base64').toString('utf-8');
  }

  if (bodyMimeType === 'text/html') {
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(decodedBody, "text/html");
        return doc.body.textContent || "";
      } catch (e) {
        console.warn("DOMParser failed to parse HTML, returning raw HTML.", e);
        return decodedBody; 
      }
    } else {
      console.warn("DOMParser not available, returning raw HTML for email body.");
      return decodedBody;
    }
  }
  
  return decodedBody.replace(/\r\n/g, '\n').trim();
}


function mapGmailMessageToEmail(message: GmailMessage, isFullMessage = false): Email {
  const headers = message.payload?.headers || [];
  const fromHeaderRaw = getHeader(headers, 'From');
  let senderName = 'Unknown Sender';
  let senderEmail = 'unknown@example.com';

  if (fromHeaderRaw) {
    const emailMatch = fromHeaderRaw.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      senderEmail = emailMatch[1].trim();
      const namePart = fromHeaderRaw.substring(0, emailMatch.index).trim();
      // Remove surrounding quotes from namePart if present
      senderName = namePart.replace(/^"(.*)"$/, '$1').trim() || senderEmail.split('@')[0] || 'Unknown Sender';
    } else if (fromHeaderRaw.includes('@')) {
      // No angle brackets, assume it's just an email or name and email
      senderEmail = fromHeaderRaw.trim();
      senderName = senderEmail.split('@')[0] || 'Unknown Sender';
    } else if (fromHeaderRaw.trim()) {
      // No email found, assume it's just a name (less common for 'From' header)
      senderName = fromHeaderRaw.trim();
    }
  }
  // Final fallback if name is still "Unknown Sender" but email was found
  if (senderName === 'Unknown Sender' && senderEmail !== 'unknown@example.com') {
    senderName = senderEmail.split('@')[0];
  }


  const receivedTime = message.internalDate
    ? formatDistanceToNowStrict(new Date(parseInt(message.internalDate, 10)), { addSuffix: true })
    : 'Unknown time';

  return {
    id: message.id,
    sender: senderName,
    senderEmail: senderEmail,
    subject: getHeader(headers, 'Subject') || '(No Subject)',
    snippet: message.snippet || '',
    body: isFullMessage ? parseMessageBody(message.payload) : (message.snippet || ''),
    receivedTime: receivedTime,
    read: !(message.labelIds?.includes('UNREAD') ?? true),
  };
}


export async function fetchEmails(accessToken: string, boxType: EmailBoxType, maxResults = 20): Promise<Email[]> {
  let labelIdsQuery: string;
  switch (boxType) {
    case 'inbox':
      labelIdsQuery = 'INBOX';
      break;
    case 'unread':
      labelIdsQuery = 'INBOX,UNREAD'; 
      break;
    case 'sent':
      labelIdsQuery = 'SENT';
      break;
    case 'drafts':
      labelIdsQuery = 'DRAFT';
      break;
    default:
      labelIdsQuery = 'INBOX';
  }

  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    labelIds: labelIdsQuery, 
    format: 'metadata', 
    metadataHeaders: 'From,Subject,Date', 
    fields: 'messages(id,snippet,internalDate,labelIds,payload(headers))',
  });

  const listResponse = await makeGmailApiCall<{ messages?: GmailMessage[], nextPageToken?: string }>(
    `/messages?${params.toString()}`,
    accessToken
  );

  if (!listResponse.messages) {
    return [];
  }
  
  return listResponse.messages.map(msg => mapGmailMessageToEmail(msg, false));
}

export async function getEmailById(accessToken: string, id: string): Promise<Email | null> {
  try {
    const message = await makeGmailApiCall<GmailMessage>(
      `/messages/${id}?format=full`, 
      accessToken
    );
    return mapGmailMessageToEmail(message, true); 
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
  inReplyTo?: string, 
  references?: string 
): Promise<{ id: string; threadId: string }> {
  
  let rawEmail = `From: me\r\n`; 
  rawEmail += `To: ${to}\r\n`;
  rawEmail += `Subject: ${subject}\r\n`;
  if (inReplyTo) {
    rawEmail += `In-Reply-To: ${inReplyTo}\r\n`;
  }
  if (references) {
    rawEmail += `References: ${references}\r\n`;
  }
  rawEmail += `Content-Type: text/plain; charset="UTF-8"\r\n`;
  rawEmail += `\r\n`; 
  rawEmail += body; 

  const base64UrlEncodedEmail = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); 

  const response = await makeGmailApiCall<{ id: string; threadId: string }>(
    `/messages/send`,
    accessToken,
    'POST',
    { raw: base64UrlEncodedEmail }
  );
  return response;
}

