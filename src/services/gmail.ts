
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
  body?: GmailMessagePartBody; // Made body optional as per some API responses for list
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

function parseMessageBody(payload?: GmailMessagePart): string {
  if (!payload) return '';

  let bodyData = '';
  let bodyMimeType = payload.mimeType;

  const findBodyPart = (currentPart: GmailMessagePart): GmailMessagePart | undefined => {
    if (currentPart.mimeType === 'text/plain' && currentPart.body?.data) {
      return currentPart;
    }
    if (currentPart.mimeType === 'text/html' && currentPart.body?.data) {
      // Prefer plain text if available, but take HTML if it's the only option
      // This function will be called recursively; plain text is prioritized at each level.
    }

    if (currentPart.parts && currentPart.parts.length > 0) {
      // Prioritize text/plain from parts
      const plainTextPart = currentPart.parts.find(p => p.mimeType === 'text/plain' && p.body?.data);
      if (plainTextPart) return plainTextPart;

      // Recurse into multipart/* parts
      for (const subPart of currentPart.parts) {
        if (subPart.mimeType.startsWith('multipart/')) {
          const foundInSubPart = findBodyPart(subPart);
          if (foundInSubPart && foundInSubPart.mimeType === 'text/plain') return foundInSubPart; // Found plain, good.
        }
      }
      
      // If no plain text found in direct parts or multipart/*, try HTML from direct parts
      const htmlPart = currentPart.parts.find(p => p.mimeType === 'text/html' && p.body?.data);
      if (htmlPart) return htmlPart;
      
      // If still nothing, try to find HTML in nested multipart/* parts
       for (const subPart of currentPart.parts) {
        if (subPart.mimeType.startsWith('multipart/')) {
          const foundInSubPart = findBodyPart(subPart);
          if (foundInSubPart && foundInSubPart.mimeType === 'text/html') return foundInSubPart;
        }
      }
    }
    // If the current part itself is HTML and no plain text was found in its children
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
        return decodedBody.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
      }
    } else {
      return decodedBody.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    }
  }
  
  return decodedBody.replace(/\r\n/g, '\n').trim();
}


function mapGmailMessageToEmail(message: GmailMessage, isFullMessage = false): Email {
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

  const headers = message.payload?.headers || [];

  if (!isFullMessage) { // Logging for list view processing
    // console.log(`[GmailService] mapGmailMessageToEmail (LIST VIEW ID: ${message.id}) - Raw message:`, JSON.stringify(message));
    if (!message.payload) {
      // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW ID: ${message.id}) - Message has no payload object.`);
    } else if (!headers.length) {
      // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW ID: ${message.id}) - Payload exists but has no headers array or it's empty. Payload:`, JSON.stringify(message.payload));
    }
  }

  const fromHeaderRaw = getHeader(headers, 'From');
  let senderName = 'Unknown Sender';
  let senderEmail = 'unknown@example.com';

  if (fromHeaderRaw) {
    const emailMatch = fromHeaderRaw.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      senderEmail = emailMatch[1].trim();
      const namePart = fromHeaderRaw.substring(0, emailMatch.index).trim();
      senderName = namePart.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
      if (!senderName && senderEmail) senderName = senderEmail.split('@')[0]; // Fallback if name part is empty
    } else if (fromHeaderRaw.includes('@')) { 
      senderEmail = fromHeaderRaw.trim();
      senderName = senderEmail.split('@')[0];
    } else if (fromHeaderRaw.trim()) {
      senderName = fromHeaderRaw.trim(); 
    }
  } else if (!isFullMessage) {
    // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW ID: ${message.id}) - 'From' header missing.`);
  }
  if (!senderName && senderEmail !== 'unknown@example.com') senderName = senderEmail.split('@')[0];
  if (!senderName) senderName = "Unknown Sender";


  const subjectHeader = getHeader(headers, 'Subject');
  const subject = subjectHeader || '(No Subject)';
  if (!subjectHeader && !isFullMessage) {
    // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW ID: ${message.id}) - 'Subject' header missing.`);
  }

  let receivedTime = 'Unknown time';
  if (message.internalDate) {
    try {
      receivedTime = formatDistanceToNowStrict(new Date(parseInt(message.internalDate, 10)), { addSuffix: true });
    } catch (e) {
      console.error(`[GmailService] Error formatting internalDate "${message.internalDate}" for message ID ${message.id}:`, e);
      receivedTime = 'Invalid date';
    }
  } else if (!isFullMessage) {
    // console.warn(`[GmailService] mapGmailMessageToEmail (LIST VIEW ID: ${message.id}) - 'internalDate' missing.`);
  }
  
  return {
    id: message.id,
    sender: senderName,
    senderEmail: senderEmail,
    subject: subject,
    snippet: message.snippet || '',
    body: isFullMessage ? parseMessageBody(message.payload) : (message.snippet || ''),
    receivedTime: receivedTime,
    read: !(message.labelIds?.includes('UNREAD') ?? false), // Default to read if labelIds is undefined
  };
}


export async function fetchEmails(accessToken: string, boxType: EmailBoxType, maxResults = 20): Promise<Email[]> {
  let labelIdsQuery: string;
  switch (boxType) {
    case 'inbox': labelIdsQuery = 'INBOX'; break;
    case 'unread': labelIdsQuery = 'UNREAD'; break;
    case 'sent': labelIdsQuery = 'SENT'; break;
    case 'drafts': labelIdsQuery = 'DRAFT'; break;
    default: labelIdsQuery = 'INBOX';
  }

  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  });

  if (boxType === 'unread') {
    params.append('labelIds', 'INBOX'); // Often unread means unread in inbox
    params.append('labelIds', 'UNREAD');
  } else {
    params.append('labelIds', labelIdsQuery);
  }
 
  // Request specific fields for each message in the list.
  // payload(headers) should give us the headers array if metadataHeaders is also specified.
  params.append('fields', 'nextPageToken,messages(id,snippet,internalDate,labelIds,payload(headers))');
  params.append('metadataHeaders', 'From,Subject'); // Tell API which headers to include in payload(headers)

  console.log(`[GmailService] fetchEmails - Requesting with params: ${params.toString()}`); // ACTIVE LOG

  const listResponse = await makeGmailApiCall<{ messages?: GmailMessage[], nextPageToken?: string }>(
    `/messages?${params.toString()}`,
    accessToken
  );

  // THIS IS THE MOST CRITICAL LOG - PLEASE PROVIDE THIS IF THE ISSUE PERSISTS
  console.log('[GmailService] fetchEmails - Raw listResponse from API:', JSON.stringify(listResponse, null, 2));

  if (!listResponse.messages || listResponse.messages.length === 0) {
    console.log('[GmailService] fetchEmails - No messages found in response or messages array is empty.');
    return [];
  }
  
  return listResponse.messages.map(msg => {
    // console.log(`[GmailService] fetchEmails - Processing message from list (ID: ${msg.id}):`, JSON.stringify(msg, null, 2));
    return mapGmailMessageToEmail(msg, false);
  });
}

export async function getEmailById(accessToken: string, id: string): Promise<Email | null> {
  try {
    const message = await makeGmailApiCall<GmailMessage>(
      `/messages/${id}?format=FULL`, // format=FULL ensures we get the full payload including body
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
  
  // Constructing a RFC 2822 compliant email string
  // Ensure UTF-8 for subject if it contains special characters, though Gmail API handles this well.
  // For simplicity, we're not explicitly encoding Subject here; modern systems often handle it.
  let rawEmailLines = [
    `To: ${to}`,
    // From: is automatically added by Gmail based on the authenticated user
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`, // or 'base64' if body has complex chars, but 7bit is safer for plain text.
  ];

  if (inReplyTo) {
    // Ensure Message-ID format for In-Reply-To, typically <id@domain>
    rawEmailLines.push(`In-Reply-To: ${inReplyTo.startsWith('<') ? inReplyTo : `<${inReplyTo}>`}`);
  }
  if (references) {
     rawEmailLines.push(`References: ${references.split(' ').map(ref => ref.startsWith('<') ? ref : `<${ref}>`).join(' ')}`);
  }
  
  rawEmailLines.push(''); // Empty line between headers and body
  rawEmailLines.push(body);

  const rawEmail = rawEmailLines.join('\r\n');

  const base64UrlEncodedEmail = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // Remove trailing '='

  const response = await makeGmailApiCall<{ id: string; threadId: string }>(
    `/messages/send`,
    accessToken,
    'POST',
    { raw: base64UrlEncodedEmail }
  );
  return response;
}
