
// MOCK GMAIL SERVICE
// In a real application, this service would use the Google Gmail API
// to fetch and send emails, utilizing the user's OAuth token.

import type { Email, EmailBoxType } from '@/types/mail';

const mockEmails: Email[] = [
  {
    id: '1',
    sender: 'Alice Wonderland',
    senderEmail: 'alice@example.com',
    subject: 'Project Phoenix Meeting',
    body: 'Hi Team,\n\nLet\'s discuss Project Phoenix progress tomorrow at 10 AM.\n\nBest,\nAlice',
    snippet: 'Let\'s discuss Project Phoenix progress...',
    receivedTime: '10:30 AM',
    read: false,
  },
  {
    id: '2',
    sender: 'Bob The Builder',
    senderEmail: 'bob@example.com',
    subject: 'Can we fix it?',
    body: 'Hey,\n\nRegarding the latest build, I think we have a few issues to address. Can we schedule a quick sync?\n\nCheers,\nBob',
    snippet: 'Regarding the latest build, I think...',
    receivedTime: 'Yesterday',
    read: true,
  },
  {
    id: '3',
    sender: 'Carol Danvers',
    senderEmail: 'carol@example.com',
    subject: 'Higher, Further, Faster - Proposal',
    body: 'Hello,\n\nI\'ve attached the proposal for the new initiative. Looking forward to your feedback.\n\nThanks,\nCarol',
    snippet: 'I\'ve attached the proposal for the new initiative...',
    receivedTime: '2 days ago',
    read: false,
  },
];

export async function fetchEmails(boxType: EmailBoxType): Promise<Email[]> {
  console.log(`Mock fetchEmails called for: ${boxType}`);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  switch (boxType) {
    case 'inbox':
      return mockEmails;
    case 'unread':
      return mockEmails.filter(email => !email.read);
    case 'sent':
      return []; // Mock: no sent emails
    case 'drafts':
      return []; // Mock: no drafts
    default:
      return mockEmails;
  }
}

export async function getEmailById(id: string): Promise<Email | null> {
  console.log(`Mock getEmailById called for: ${id}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockEmails.find(email => email.id === id) || null;
}

export async function sendEmail(to: string, subject: string, body: string, originalEmailThreadId?: string): Promise<{ id: string, threadId: string }> {
  console.log(`Mock sendEmail called: To: ${to}, Subject: ${subject}, OriginalThread: ${originalEmailThreadId}`);
  console.log('Body:', body);
  // Simulate API delay and response
  await new Promise(resolve => setTimeout(resolve, 700));
  return { id: `sent_${Date.now()}`, threadId: originalEmailThreadId || `thread_${Date.now()}` };
}

// Helper function to mark an email as read (mock)
export async function markEmailAsRead(id: string): Promise<void> {
  console.log(`Mock markEmailAsRead called for: ${id}`);
  const email = mockEmails.find(e => e.id === id);
  if (email) {
    email.read = true;
  }
  await new Promise(resolve => setTimeout(resolve, 100));
}
