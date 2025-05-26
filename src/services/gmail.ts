
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
    const errorData = await response.json().catch(() => ({ message: 'Unknown API error (failed to parse error JSON)' }));
    console.error(`[GmailService] API Error: ${response.status} ${response.statusText} for ${method} ${endpoint}. Response:`, errorData);
    throw new Error(errorData.error?.message || `Gmail API request failed: ${response.status}`);
  }
  return response.json() as T;
}

function getHeader(headers: GmailHeader[], name: string): string | undefined {
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

function parseMessageBody(payload?: GmailMessagePart): string {
  if (!payload) return '';
  // console.log('[GmailService] parseMessageBody - Full payload:', JSON.stringify(payload, null, 2));

  let bodyData = '';
  let bodyMimeType = payload.mimeType;

  const findBodyPart = (parts?: GmailMessagePart[]): GmailMessagePart | undefined => {
    if (!parts) return undefined;
    let plainTextPart = parts.find(part => part.mimeType === 'text/plain' && part.body?.data);
    if (plainTextPart) return plainTextPart;
    
    let htmlPart = parts.find(part => part.mimeType === 'text/html' && part.body?.data);
    if (htmlPart) return htmlPart;

    // Check for multipart/alternative which often nests text/plain and text/html
    for (const part of parts) {
      if (part.mimeType.startsWith('multipart/') && part.parts) {
        const nestedFoundPart = findBodyPart(part.parts);
        if (nestedFoundPart) return nestedFoundPart;
      }
    }
    return undefined;
  };
  
  let chosenPart = findBodyPart(payload.parts);

  if (chosenPart && chosenPart.body?.data) {
    bodyData = chosenPart.body.data;
    bodyMimeType = chosenPart.mimeType;
  } else if (payload.body?.data && (payload.mimeType === 'text/plain' || payload.mimeType === 'text/html')) {
    // Fallback to main payload's body if it's directly text/* and has data
    bodyData = payload.body.data;
    bodyMimeType = payload.mimeType;
  } else if (payload.body?.data && !chosenPart) {
    // If no suitable part found, but main payload has data, use it (might be non-text)
    // This is less ideal, but better than nothing if primary text parts are missing.
    // console.warn('[GmailService] parseMessageBody - Using main payload body data as fallback. MimeType:', payload.mimeType);
    bodyData = payload.body.data;
    bodyMimeType = payload.mimeType;
  }

  if (!bodyData) {
    // console.log('[GmailService] parseMessageBody - No body data found in payload or its parts.');
    return '';
  }

  let decodedBody = '';
  try {
    const standardBase64 = base64UrlToBase64(bodyData);
    decodedBody = Buffer.from(standardBase64, 'base64').toString('utf-8');
  } catch (e) {
    console.error("[GmailService] Error decoding base64 body data:", e, "Original data snippet:", bodyData.substring(0,50));
    return "Error decoding email body.";
  }

  if (bodyMimeType === 'text/html') {
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(decodedBody, "text/html");
        return doc.body.textContent || "";
      } catch (e) {
        console.warn("[GmailService] DOMParser failed to parse HTML, returning stripped HTML.", e);
        return decodedBody.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
      }
    } else {
      // console.warn("[GmailService] DOMParser not available, returning stripped HTML for email body.");
      return decodedBody.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    }
  }
  
  return decodedBody.replace(/\r\n/g, '\n').trim();
}


function mapGmailMessageToEmail(message: GmailMessage, isFullMessage = false): Email {
  if (!message || !message.id) {
    console.warn('[GmailService] mapGmailMessageToEmail - Received invalid message object:', message);
    return {
      id: 'unknown-id-' + Math.random(),
      sender: 'Invalid Message Object',
      senderEmail: 'error@example.com',
      subject: 'Invalid Message Data',
      snippet: '',
      body: '',
      receivedTime: 'Unknown time',
      read: true,
    };
  }

  // Log for list view if headers are missing
  if (!isFullMessage) {
    // console.log(`[GmailService] mapGmailMessageToEmail (LIST VIEW) - Raw message object for ID ${message.id}:`, JSON.stringify(message, null, 2));
    if (!message.payload?.headers) {
      // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW) - Message ID ${message.id} has no payload.headers.`);
    }
  }

  const headers = message.payload?.headers || [];
  const fromHeaderRaw = getHeader(headers, 'From');
  let senderName = 'Unknown Sender';
  let senderEmail = 'unknown@example.com';

  if (fromHeaderRaw) {
    const emailMatch = fromHeaderRaw.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      senderEmail = emailMatch[1].trim();
      const namePart = fromHeaderRaw.substring(0, emailMatch.index).trim();
      senderName = namePart.replace(/^"(.*)"$/, '$1').trim() || senderEmail.split('@')[0] || 'Unknown Sender';
    } else if (fromHeaderRaw.includes('@')) { // If no <>, assume it's just an email or "Name <email>" without quotes
      const parts = fromHeaderRaw.split('<');
      if (parts.length > 1) {
        senderName = parts[0].trim().replace(/^"(.*)"$/, '$1');
        senderEmail = parts[1].replace('>', '').trim();
      } else {
        senderEmail = fromHeaderRaw.trim();
      }
      // If senderName is still empty or same as email, try to get it from before '@'
      if (!senderName || senderName === senderEmail) {
        senderName = senderEmail.split('@')[0] || 'Unknown Sender';
      }
    } else if (fromHeaderRaw.trim()) { // No email, just a name (less common for 'From')
      senderName = fromHeaderRaw.trim();
    }
  }
  
  if (senderName === 'Unknown Sender' && senderEmail !== 'unknown@example.com' && senderEmail.includes('@')) {
    senderName = senderEmail.split('@')[0];
  }
  if (!senderName && senderEmail === 'unknown@example.com') { // If all parsing fails
    senderName = 'Unknown Sender (Parsing Failed)';
  }


  const subjectHeader = getHeader(headers, 'Subject');
  const subject = subjectHeader || '(No Subject)';

  if (!isFullMessage && !subjectHeader) {
    // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW) - Message ID ${message.id} has no Subject header. All headers:`, JSON.stringify(headers, null, 2));
  }
   if (!isFullMessage && !fromHeaderRaw) {
    // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW) - Message ID ${message.id} has no From header. All headers:`, JSON.stringify(headers, null, 2));
  }


  const receivedTime = message.internalDate
    ? formatDistanceToNowStrict(new Date(parseInt(message.internalDate, 10)), { addSuffix: true })
    : 'Unknown time';
  
  if (!isFullMessage && !message.internalDate) {
    // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW) - Message ID ${message.id} has no internalDate.`);
  }

  return {
    id: message.id,
    sender: senderName,
    senderEmail: senderEmail,
    subject: subject,
    snippet: message.snippet || '',
    body: isFullMessage ? parseMessageBody(message.payload) : (message.snippet || ''), // For list view, body is just snippet
    receivedTime: receivedTime,
    read: !(message.labelIds?.includes('UNREAD') ?? true),
  };
}


export async function fetchEmails(accessToken: string, boxType: EmailBoxType, maxResults = 20): Promise<Email[]> {
  let labelIdsQuery: string;
  switch (boxType) {
    case 'inbox': labelIdsQuery = 'INBOX'; break;
    case 'unread': labelIdsQuery = 'UNREAD'; break; // Gmail handles this directly
    case 'sent': labelIdsQuery = 'SENT'; break;
    case 'drafts': labelIdsQuery = 'DRAFT'; break;
    default: labelIdsQuery = 'INBOX';
  }

  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  });

  if (boxType === 'unread') {
    // For unread, we still specify INBOX as well if we want to limit to unread *in the inbox*
    // If we only want 'UNREAD' anywhere, then just 'UNREAD' is fine. Let's assume unread in inbox.
    params.append('labelIds', 'INBOX');
    params.append('labelIds', 'UNREAD');
  } else {
    params.append('labelIds', labelIdsQuery);
  }
 
  // Crucially, ensure payload.headers and internalDate are requested for the list.
  // Removed `format: 'metadata'` to rely solely on `fields`.
  params.append('fields', 'nextPageToken,messages(id,snippet,internalDate,labelIds,payload/headers)');
  params.append('metadataHeaders', 'From,Subject');


  const listResponse = await makeGmailApiCall<{ messages?: GmailMessage[], nextPageToken?: string }>(
    `/messages?${params.toString()}`,
    accessToken
  );

  // Log the raw response from the API to inspect its structure
  // console.log('[GmailService] fetchEmails - Raw listResponse from API:', JSON.stringify(listResponse, null, 2));

  if (!listResponse.messages || listResponse.messages.length === 0) {
    // console.log('[GmailService] fetchEmails - No messages found in response or messages array is empty.');
    return [];
  }
  
  return listResponse.messages.map(msg => {
    // Log each individual message object as received from the list response
    // console.log('[GmailService] fetchEmails - Processing message from list (ID: ${msg.id}):', JSON.stringify(msg, null, 2));
    return mapGmailMessageToEmail(msg, false);
  });
}

export async function getEmailById(accessToken: string, id: string): Promise<Email | null> {
  try {
    // console.log(`[GmailService] getEmailById - Fetching full message for ID: ${id}`);
    const message = await makeGmailApiCall<GmailMessage>(
      `/messages/${id}?format=full`, // format=full ensures we get the body
      accessToken
    );
    // console.log(`[GmailService] getEmailById - Full message response for ID ${id}:`, JSON.stringify(message, null, 2));
    return mapGmailMessageToEmail(message, true); 
  } catch (error) {
    console.error(`[GmailService] Error fetching email by ID ${id}:`, error);
    return null;
  }
}

export async function markEmailAsRead(accessToken: string, id: string): Promise<void> {
  // console.log(`[GmailService] markEmailAsRead - Marking email ID as read: ${id}`);
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
    // From: is automatically added by Gmail based on the authenticated user
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit` // Good practice for plain text
  ];

  if (inReplyTo) {
    rawEmailLines.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    rawEmailLines.push(`References: ${references}`);
  }
  
  // Add an empty line between headers and body
  rawEmailLines.push(''); 
  rawEmailLines.push(body);

  const rawEmail = rawEmailLines.join('\r\n');

  // console.log('[GmailService] sendEmail - Raw email being sent:\n', rawEmail);

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
  // console.log('[GmailService] sendEmail - API Response:', response);
  return response;
}
