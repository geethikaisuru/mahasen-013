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
  
  // Enhanced insights from comprehensive analysis
  behavioralPatterns: BehavioralPattern[];
  contextualResponses: ContextualResponse[];
  temporalPatterns: TemporalPattern[];
  knowledgeAreas: KnowledgeArea[];
  
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
  behavioralPatterns: BehavioralPattern[];
  contextualResponses: ContextualResponse[];
  temporalPatterns: TemporalPattern[];
  knowledgeAreas: KnowledgeArea[];
  confidence: number;
}

export interface CommunicationInsight {
  type: 'tone' | 'formality' | 'greeting_style' | 'sign_off_style' | 'response_timing' | 'sentence_structure' | 'emoji_usage' | 'punctuation_style' | 'language_preference' | 'style_variation';
  description: string;
  evidence: string[];
  confidence: number;
  contactEmail?: string;
  contextual_factors?: string[];
}

export interface RelationshipInsight {
  contactEmail: string;
  suggestedCategory: ContactCategory;
  relationshipDynamics?: string;
  communicationFrequency?: 'daily' | 'weekly' | 'monthly' | 'occasional' | 'rare';
  responseTimePattern?: 'immediate' | 'within_hours' | 'business_hours' | 'delayed' | 'varies';
  initiationPattern?: 'user_initiates' | 'contact_initiates' | 'mutual' | 'unknown';
  evidence: string[];
  confidence: number;
  sharedContexts?: string[];
  addressingStyle?: string;
  communicationPattern?: string; // Keep for backward compatibility
}

export interface ProfessionalInsight {
  type: 'role' | 'company' | 'department' | 'responsibilities' | 'expertise' | 'authority_level' | 'decision_making' | 'meeting_preferences' | 'work_schedule' | 'project_involvement' | 'industry_knowledge' | 'networking_style' | 'management_level' | 'reporting_structure';
  value: string;
  evidence: string[];
  confidence: number;
  context?: string;
}

export interface PersonalInsight {
  type: 'schedule_preference' | 'availability_pattern' | 'family_information' | 'hobby_interest' | 'travel_preference' | 'food_preference' | 'entertainment_choice' | 'value_belief' | 'decision_making_style' | 'conflict_resolution' | 'stress_indicator' | 'privacy_boundary' | 'seasonal_pattern' | 'routine_habit' | 'brand_preference' | 'location_preference' | 'restaurant_preference' | 'shopping_habit' | 'daily_routine' | 'cultural_preference' | 'learning_preference' | 'information_consumption' | 'leisure_activity' | 'sports_team' | 'music_preference' | 'book_preference' | 'movie_preference' | 'technology_preference' | 'social_media_usage' | 'communication_channel_preference' | 'preference' | 'interest' | 'schedule' | 'decision_style' | 'communication_preference'; // Keep old types for backward compatibility
  value: string;
  evidence: string[];
  confidence: number;
  category?: 'personal' | 'family' | 'lifestyle' | 'preferences' | 'behavioral' | 'temporal' | 'cultural' | 'entertainment' | 'consumption';
}

export interface BehavioralPattern {
  type: 'delegation_comfort' | 'request_handling' | 'invitation_response' | 'urgency_handling' | 'information_sharing' | 'boundary_setting' | 'escalation_trigger' | 'group_dynamics' | 'leadership_style' | 'collaboration_preference';
  pattern: string;
  triggers: string[];
  evidence: string[];
  confidence: number;
}

export interface ContextualResponse {
  scenario: string;
  typical_response_style: string;
  formality_level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  key_phrases: string[];
  evidence: string[];
  confidence: number;
}

export interface TemporalPattern {
  type: 'response_timing' | 'availability_hours' | 'seasonal_behavior' | 'deadline_handling' | 'time_sensitivity';
  pattern: string;
  specific_times?: string[];
  evidence: string[];
  confidence: number;
}

export interface KnowledgeArea {
  domain: string;
  expertise_level: 'novice' | 'intermediate' | 'advanced' | 'expert';
  evidence: string[];
  confidence: number;
  context?: string;
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
    timeRange: 'last_month' | 'last_3months' | 'last_6months' | 'last_year' | 'last_2years' | 'last_3years' | 'last_5years' | 'all_time';
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