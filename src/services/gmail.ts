
import type { Email, EmailBoxType } from '@/types/mail';
import { formatDistanceToNowStrict } from 'date-fns';

const GMAIL_API_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePartBody {
  attachmentId?: string;
  size: number;
  data?: string; // base64url encoded
}

interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: GmailHeader[];
  body?: GmailMessagePartBody;
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
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown API error (failed to parse error JSON)' } }));
    console.error(`[GmailService] API Error: ${response.status} ${response.statusText} for ${method} ${endpoint}. Response:`, errorData);
    throw new Error(errorData.error?.message || `Gmail API request failed: ${response.status}`);
  }
  return response.json() as T;
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string | undefined {
  if (!headers || headers.length === 0) return undefined;
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

function base64UrlToBase64(base64Url: string): string {
  if (!base64Url) return '';
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

function parseMessageBodyContent(payload?: GmailMessagePart): string {
  if (!payload) return '';

  let bodyData = '';
  let bodyMimeType = payload.mimeType;

  const findBodyPart = (currentPart: GmailMessagePart): GmailMessagePart | undefined => {
    if (currentPart.mimeType === 'text/plain' && currentPart.body?.data) {
      return currentPart;
    }
    if (currentPart.mimeType === 'text/html' && currentPart.body?.data) {
      // Will be chosen if no plain text found at this level or deeper
    }

    if (currentPart.parts && currentPart.parts.length > 0) {
      const plainTextPart = currentPart.parts.find(p => p.mimeType === 'text/plain' && p.body?.data);
      if (plainTextPart) return plainTextPart;

      for (const subPart of currentPart.parts) {
        if (subPart.mimeType.startsWith('multipart/')) {
          const foundInSubPart = findBodyPart(subPart);
          if (foundInSubPart?.mimeType === 'text/plain') return foundInSubPart;
        }
      }
      
      const htmlPart = currentPart.parts.find(p => p.mimeType === 'text/html' && p.body?.data);
      if (htmlPart) return htmlPart;
      
      for (const subPart of currentPart.parts) {
        if (subPart.mimeType.startsWith('multipart/')) {
          const foundInSubPart = findBodyPart(subPart);
          if (foundInSubPart?.mimeType === 'text/html') return foundInSubPart;
        }
      }
    }
    // Fallback to current part if it's text/html and has data, and nothing better was found
    if (currentPart.mimeType === 'text/html' && currentPart.body?.data) {
        return currentPart;
    }
    return undefined;
  };
  
  const chosenPart = findBodyPart(payload);

  if (chosenPart?.body?.data) {
    bodyData = chosenPart.body.data;
    bodyMimeType = chosenPart.mimeType;
  } else if (payload.body?.data && (payload.mimeType === 'text/plain' || payload.mimeType === 'text/html')) {
    // Fallback for simple, non-multipart messages directly having body data on the main payload
    bodyData = payload.body.data;
    bodyMimeType = payload.mimeType;
  }


  if (!bodyData) {
    return '';
  }

  let decodedBody = '';
  try {
    const standardBase64 = base64UrlToBase64(bodyData);
    decodedBody = Buffer.from(standardBase64, 'base64').toString('utf-8');
  } catch (e) {
    console.error("[GmailService] Error decoding base64 body data:", e);
    return "Error decoding email body.";
  }

  if (bodyMimeType === 'text/html') {
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(decodedBody, "text/html");
        return doc.body.textContent || "";
      } catch (e) {
        console.warn("[GmailService] DOMParser failed for HTML body, falling back to regex stripping:", e);
        return decodedBody.replace(/<style[^>]*>.*<\/style>/gms, '') 
                           .replace(/<script[^>]*>.*<\/script>/gms, '') 
                           .replace(/<[^>]+>/g, ' ') 
                           .replace(/\s+/g, ' ').trim(); 
      }
    } else {
      return decodedBody.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    }
  }
  return decodedBody.replace(/\r\n/g, '\n').trim();
}


function mapGmailMessageToEmail(message: GmailMessage, parseBody: boolean): Email {
  // console.log(`[GmailService] mapGmailMessageToEmail - ID: ${message.id}, parseBody: ${parseBody}, Full Message:`, JSON.stringify(message, null, 2));

  if (!message || !message.id) {
    console.warn('[GmailService] mapGmailMessageToEmail - Received invalid or incomplete message object:', message);
    return {
      id: 'unknown-id-' + Math.random().toString(36).substring(2, 9),
      sender: 'Invalid Message Data',
      senderEmail: 'error@example.com',
      subject: 'Invalid Data',
      snippet: message?.snippet || 'No snippet available for invalid message.',
      body: '',
      receivedTime: 'Unknown time',
      read: true,
    };
  }
  
  const headers = message.payload?.headers;
  
  if (!parseBody && !headers) {
    // This can happen if messages.get(format=METADATA) doesn't return payload.headers as expected
    console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW METADATA) ID: ${message.id} - message.payload.headers is missing. Full message object:`, JSON.stringify(message, null, 2));
  }


  const fromHeaderRaw = getHeader(headers, 'From');
  let senderName = 'Unknown Sender';
  let senderEmail = 'unknown@example.com';

  if (fromHeaderRaw) {
    const emailMatch = fromHeaderRaw.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      senderEmail = emailMatch[1].trim();
      const namePart = fromHeaderRaw.substring(0, emailMatch.index).trim();
      senderName = namePart.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim() || senderEmail.split('@')[0];
    } else if (fromHeaderRaw.includes('@')) { 
      senderEmail = fromHeaderRaw.trim();
      senderName = senderEmail.split('@')[0];
    } else if (fromHeaderRaw.trim()) {
      senderName = fromHeaderRaw.trim(); 
    }
  } else if (!parseBody) {
     console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW METADATA) ID: ${message.id} - 'From' header missing. Headers:`, JSON.stringify(headers));
  }
   if (senderName === 'Unknown Sender' && senderEmail !== 'unknown@example.com') {
       senderName = senderEmail.split('@')[0] || 'Sender';
   }


  const subjectHeader = getHeader(headers, 'Subject');
  const subject = subjectHeader || '(No Subject)';
  if (!subjectHeader && !parseBody) {
    console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW METADATA) ID: ${message.id} - 'Subject' header missing. Headers:`, JSON.stringify(headers));
  }

  let receivedTime = 'Unknown time';
  if (message.internalDate) {
    try {
      receivedTime = formatDistanceToNowStrict(new Date(parseInt(message.internalDate, 10)), { addSuffix: true });
    } catch (e) {
      console.error(`[GmailService] Error formatting internalDate "${message.internalDate}" for message ID ${message.id}:`, e);
      receivedTime = 'Invalid date';
    }
  } else if (!parseBody) {
    console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW METADATA) ID: ${message.id} - 'internalDate' missing.`);
  }
  
  return {
    id: message.id,
    sender: senderName,
    senderEmail: senderEmail,
    subject: subject,
    snippet: message.snippet || '', 
    body: parseBody ? parseMessageBodyContent(message.payload) : '',
    receivedTime: receivedTime,
    read: !(message.labelIds?.includes('UNREAD') ?? false), // Default to true (read) if labelIds is undefined
  };
}


export async function fetchEmails(accessToken: string, boxType: EmailBoxType, maxResults = 20): Promise<Email[]> {
  // Phase 1: Get only message IDs
  const listParams = new URLSearchParams({
    maxResults: maxResults.toString(),
    fields: 'nextPageToken,messages/id', // Only request IDs and nextPageToken
  });

  let labelIdsQuery: string;
  switch (boxType) {
    case 'inbox': labelIdsQuery = 'INBOX'; break;
    case 'unread': labelIdsQuery = 'UNREAD'; break; // UNREAD implies INBOX as well
    case 'sent': labelIdsQuery = 'SENT'; break;
    case 'drafts': labelIdsQuery = 'DRAFT'; break;
    default: labelIdsQuery = 'INBOX';
  }
  
  if (boxType === 'unread') {
    listParams.append('labelIds', 'INBOX'); // For unread, ensure it's in inbox
    listParams.append('labelIds', 'UNREAD');
  } else {
    listParams.append('labelIds', labelIdsQuery);
  }
  
  console.log(`[GmailService] fetchEmails (Phase 1: List IDs) - Requesting with params: ${listParams.toString()}`);
  const listResponse = await makeGmailApiCall<{ messages?: { id: string }[], nextPageToken?: string }>(
    `/messages?${listParams.toString()}`,
    accessToken
  );
  
  console.log('[GmailService] fetchEmails (Phase 1: List IDs) - Raw listResponse from API:', JSON.stringify(listResponse, null, 2));

  if (!listResponse.messages || listResponse.messages.length === 0) {
    console.log('[GmailService] fetchEmails - No messages found in initial list response.');
    return [];
  }

  // Phase 2: For each ID, get its metadata using messages.get with format=METADATA
  console.log(`[GmailService] fetchEmails (Phase 2: Get Metadata) - Fetching details for ${listResponse.messages.length} messages.`);
  
  const emailDetailsPromises = listResponse.messages.map(async (msg) => {
    if (!msg.id) {
        console.warn('[GmailService] fetchEmails - Found a message object without an ID in listResponse:', msg);
        return null;
    }
    try {
      // Request specific headers: From, Subject, Date
      // According to docs, format=METADATA gets: id, threadId, labelIds, snippet, historyId, internalDate, payload (headers, filename, mimeType, partId, parts), sizeEstimate
      const detail = await makeGmailApiCall<GmailMessage>(
        `/messages/${msg.id}?format=METADATA&metadataHeaders=From,Subject,Date`,
        accessToken
      );
      // CRITICAL LOG: This will show if individual GET calls are returning the needed payload
      console.log(`[GmailService] fetchEmails (Phase 2) - Metadata received for ${msg.id}:`, JSON.stringify(detail, null, 2));
      
      return mapGmailMessageToEmail(detail, false); // parseBody is false for list view metadata
    } catch (error) {
      console.error(`[GmailService] fetchEmails (Phase 2) - Error fetching metadata for message ${msg.id}:`, error);
      return null; 
    }
  });

  const resolvedEmailDetails = await Promise.all(emailDetailsPromises);
  const validEmails = resolvedEmailDetails.filter((email): email is Email => email !== null);
  
  console.log(`[GmailService] fetchEmails (Phase 3: Mapping Complete) - Successfully mapped ${validEmails.length} emails.`);
  return validEmails;
}


export async function getEmailById(accessToken: string, id: string): Promise<Email | null> {
  try {
    const message = await makeGmailApiCall<GmailMessage>(
      `/messages/${id}?format=FULL`, 
      accessToken
    );
    return mapGmailMessageToEmail(message, true); 
  } catch (error) {
    console.error(`[GmailService] Error fetching email by ID ${id}:`, error);
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
  
  let rawEmailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
  ];

  if (inReplyTo) {
    rawEmailLines.push(`In-Reply-To: ${inReplyTo.startsWith('<') ? inReplyTo : `<${inReplyTo}>`}`);
  }
  if (references) {
     rawEmailLines.push(`References: ${references.split(' ').map(ref => ref.startsWith('<') ? ref : `<${ref}>`).join(' ')}`);
  }
  
  rawEmailLines.push(''); 
  rawEmailLines.push(body);

  const rawEmail = rawEmailLines.join('\r\n');

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
