// Personal Context Type Definitions

export interface PersonalContextProfile {
  id: string;
  userId: string;
  version: number;
  confidence: number;
  lastAnalyzed: Date;
  lastUpdated: Date;
  
  // Communication patterns discovered from email analysis
  communicationPatterns: {
    globalStyle: CommunicationStyle;
    contactSpecificStyles: Record<string, ContactCommunicationStyle>;
  };
  
  // Relationship mapping and contact classification
  relationships: {
    contacts: Record<string, ContactRelationship>;
    relationshipTypes: ContactCategory[];
  };
  
  // Professional profile extracted from work emails
  professionalProfile: ProfessionalProfile;
  
  // Personal preferences and patterns
  personalPreferences: PersonalPreferences;
  
  // Learning progress and metadata
  learningMetadata: LearningMetadata;
}

export interface CommunicationStyle {
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'direct' | 'diplomatic';
  formality: number; // 1-10 scale
  greetingStyle: string[];
  closingStyle: string[];
  sentenceStructure: 'short' | 'medium' | 'long' | 'mixed';
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'frequent';
  punctuationStyle: string;
  responseLength: 'brief' | 'moderate' | 'detailed';
  languagePreferences: string[];
}

export interface ContactCommunicationStyle {
  contactEmail: string;
  style: CommunicationStyle;
  confidence: number;
  lastUpdated: Date;
  sampleCount: number;
}

export interface ContactRelationship {
  contactEmail: string;
  contactName?: string;
  relationshipType: ContactCategory;
  confidence: number;
  communicationFrequency: 'daily' | 'weekly' | 'monthly' | 'occasional' | 'rare';
  responseTimePattern: 'immediate' | 'business_hours' | 'delayed' | 'weekend_ok';
  communicationInitiator: 'user' | 'contact' | 'mutual';
  sharedContexts: string[];
  lastInteraction: Date;
  totalInteractions: number;
  averageResponseTime: number; // in minutes
}

export type ContactCategory = 
  | 'family'
  | 'close_friends'
  | 'work_colleagues'
  | 'clients_customers'
  | 'executives_bosses'
  | 'vendors_service_providers'
  | 'unknown_cold_outreach'
  | 'academic_contacts'
  | 'community_organization'
  | 'government_official';

export interface ProfessionalProfile {
  jobTitle?: string;
  company?: string;
  industry?: string;
  department?: string;
  managementLevel: 'individual' | 'team_lead' | 'manager' | 'director' | 'executive';
  expertise: string[];
  workingHours?: {
    timezone: string;
    startHour: number;
    endHour: number;
    workDays: number[]; // 0-6, Sunday-Saturday
  };
  meetingPatterns: {
    preferredDuration: number; // in minutes
    preferredTimes: string[];
    meetingStyle: 'formal' | 'casual' | 'mixed';
  };
  projectsAndResponsibilities: string[];
  networkingStyle: 'active' | 'passive' | 'selective';
  decisionMakingAuthority: string[];
}

export interface PersonalPreferences {
  responseTimingPatterns: {
    businessHours: boolean;
    eveningEmails: boolean;
    weekendEmails: boolean;
    urgentResponseTime: number; // in hours
    normalResponseTime: number; // in hours
  };
  
  communicationPreferences: {
    preferredChannels: string[];
    formalityByContext: Record<string, number>;
    topicPreferences: string[];
    avoidanceTopics: string[];
  };
  
  decisionMakingStyle: 'quick' | 'deliberate' | 'collaborative' | 'independent' | 'data_driven';
  conflictResolutionApproach: 'direct' | 'diplomatic' | 'avoidance' | 'collaborative';
  
  schedulingPreferences: {
    preferredMeetingTimes: string[];
    bufferTimeNeeded: number; // in minutes
    backToBackTolerance: boolean;
  };
  
  personalInterests: string[];
  valuesAndBeliefs: string[];
}

export interface LearningMetadata {
  emailsAnalyzed: number;
  threadsAnalyzed: number;
  contactsClassified: number;
  lastFullAnalysis?: Date;
  analysisTimeRange: {
    startDate: Date;
    endDate: Date;
  };
  confidenceScores: {
    overall: number;
    communicationStyle: number;
    relationships: number;
    professionalProfile: number;
    personalPreferences: number;
  };
  learningSource: 'historical_analysis' | 'real_time_learning' | 'manual_input' | 'hybrid';
}

// Thread and Email Analysis Types
export interface EmailThread {
  threadId: string;
  subject: string;
  participants: string[];
  messageCount: number;
  userParticipation: boolean;
  firstMessageDate: Date;
  lastMessageDate: Date;
  messages: ThreadMessage[];
  threadCategory: 'work' | 'personal' | 'commercial' | 'automated' | 'unknown';
}

export interface ThreadMessage {
  messageId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  timestamp: Date;
  isFromUser: boolean;
  headers: Record<string, string>;
}

export interface ThreadAnalysisResult {
  threadId: string;
  communicationInsights: CommunicationInsight[];
  relationshipInsights: RelationshipInsight[];
  professionalInsights: ProfessionalInsight[];
  personalInsights: PersonalInsight[];
  confidence: number;
}

export interface CommunicationInsight {
  type: 'tone' | 'formality' | 'response_pattern' | 'style_variation';
  description: string;
  evidence: string[];
  confidence: number;
  contactEmail?: string;
}

export interface RelationshipInsight {
  contactEmail: string;
  suggestedCategory: ContactCategory;
  evidence: string[];
  confidence: number;
  communicationPattern: string;
}

export interface ProfessionalInsight {
  type: 'role' | 'company' | 'expertise' | 'responsibility' | 'authority';
  value: string;
  evidence: string[];
  confidence: number;
}

export interface PersonalInsight {
  type: 'preference' | 'interest' | 'schedule' | 'decision_style' | 'communication_preference';
  value: string;
  evidence: string[];
  confidence: number;
}

// Learning Progress and State Management
export interface LearningProgress {
  userId: string;
  currentPhase: 'discovery' | 'analysis' | 'learning' | 'complete' | 'error';
  progress: number; // 0-100
  threadsDiscovered: number;
  threadsAnalyzed: number;
  emailsAnalyzed: number;
  contactsClassified: number;
  startTime: Date;
  estimatedCompletion?: Date;
  lastError?: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
}

// API and Service Types
export interface PersonalContextLearningInput {
  userId: string;
  accessToken: string;
  options: {
    timeRange: 'last_month' | 'last_3months' | 'last_6months' | 'last_year';
    analysisDepth: 'basic' | 'standard' | 'comprehensive';
    includePromotional: boolean;
    minThreadLength: number;
  };
}

export interface PersonalContextUpdateInput {
  userId: string;
  emailContent: string;
  recipientEmail: string;
  userReply: string;
  threadContext?: EmailThread;
}

// Firestore Document Interfaces
export interface PersonalContextDocument {
  id: string;
  userId: string;
  profile: PersonalContextProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactRelationshipDocument {
  id: string;
  userId: string;
  contactEmail: string;
  relationship: ContactRelationship;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunicationPatternDocument {
  id: string;
  userId: string;
  contactEmail: string;
  pattern: ContactCommunicationStyle;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningProgressDocument {
  id: string;
  userId: string;
  progress: LearningProgress;
  createdAt: Date;
  updatedAt: Date;
} 