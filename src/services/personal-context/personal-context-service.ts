import type {
  PersonalContextLearningInput,
  PersonalContextUpdateInput,
  PersonalContextProfile,
  LearningProgress,
  ContactRelationship,
  ContactCommunicationStyle,
  LearningMetadata,
  CommunicationStyle,
  ProfessionalProfile,
  PersonalPreferences
} from '@/types/personal-context';

import { gmailService } from './gmail-service';
import { personalContextAnalysisService } from './analysis-service';
import { personalContextStore } from './context-store';

// Helper function to emit logs to the UI
const emitLog = (message: string) => {
  // Log to console first
  console.log(`[PersonalContextService] ${message}`);
  
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('personal-context-log', {
      detail: { message, source: 'service' }
    });
    window.dispatchEvent(event);
  }
};

// Capture all console logs related to personal context
// This needs to happen at module initialization time to catch all logs
if (typeof window !== 'undefined') {
  // We're in the browser, so we can override console.log
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    // Call the original console.log
    originalConsoleLog.apply(console, args);
    
    // Convert args to string for analysis
    const logStr = typeof args[0] === 'string' ? args[0] : args.join(' ');
    
    // Capture ALL terminal logs related to our application - more inclusive pattern
    // Send all relevant logs to UI
    if (typeof logStr === 'string') {
      // Determine the source based on log content
      let source = 'server'; // Default source
      
      if (logStr.includes('[GmailService]')) {
        source = 'gmail';
      } else if (logStr.includes('[AnalysisService]')) {
        source = 'analysis';
      } else if (logStr.includes('[PersonalContextService]')) {
        source = 'service';
      } else if (logStr.includes('[PersonalContextAPI]') || logStr.includes('[API]')) {
        source = 'server';
      } else if (logStr.includes('[PersonalContextStore]')) {
        source = 'service';
      } else if (logStr.includes('WARNING:') || logStr.includes('Compiling')) {
        source = 'server';
      } else if (logStr.includes('GET /api/personal-context') || logStr.includes('POST /api/personal-context')) {
        source = 'server';
      }
      
      // Send to the UI via event
      const event = new CustomEvent('personal-context-log', {
        detail: { message: logStr, source }
      });
      window.dispatchEvent(event);
    }
  };
}

export class PersonalContextService {
  private static instance: PersonalContextService;
  
  private constructor() {}
  
  public static getInstance(): PersonalContextService {
    if (!PersonalContextService.instance) {
      PersonalContextService.instance = new PersonalContextService();
    }
    return PersonalContextService.instance;
  }

  /**
   * Main entry point for learning personal context from Gmail
   */
  async learnPersonalContext(input: PersonalContextLearningInput): Promise<{
    success: boolean;
    profile?: PersonalContextProfile;
    error?: string;
  }> {
    try {
      console.log(`[PersonalContextService] Starting personal context learning for user: ${input.userId}`);
      emitLog(`Starting personal context learning for user: ${input.userId}`);
      
      // Initialize learning progress
      const initialProgress: LearningProgress = {
        userId: input.userId,
        currentPhase: 'discovery',
        progress: 0,
        threadsDiscovered: 0,
        threadsAnalyzed: 0,
        emailsAnalyzed: 0,
        contactsClassified: 0,
        startTime: new Date(),
        status: 'running'
      };
      
      // Try to save initial progress, but continue if it fails
      try {
        await personalContextStore.saveLearningProgress(input.userId, initialProgress);
      } catch (progressError: any) {
        console.warn('[PersonalContextService] Failed to save initial progress, continuing without progress tracking:', progressError);
      }
      
      // Phase 1: Discover Gmail threads
      emitLog(`Phase 1: Discovering Gmail threads...`);
      await this.updateProgress(input.userId, 'discovery', 10);
      
      // Get user's Gmail profile first
      emitLog(`Retrieving Gmail profile...`);
      const gmailProfile = await gmailService.getUserProfile(input.accessToken);
      if (!gmailProfile) {
        throw new Error('Failed to access Gmail profile');
      }
      
      console.log(`[PersonalContextService] Fetching threads for ${gmailProfile.emailAddress}`);
      emitLog(`Fetching interactive threads for ${gmailProfile.emailAddress}...`);
      
      const threadsResponse = await gmailService.fetchInteractiveThreads(
        input.accessToken,
        gmailProfile.emailAddress,
        input.options
      );
      
      console.log(`[PersonalContextService] Discovered ${threadsResponse.threads.length} interactive threads`);
      emitLog(`Discovered ${threadsResponse.threads.length} interactive threads for analysis`);
      
      await this.updateProgress(input.userId, 'analysis', 30, {
        threadsDiscovered: threadsResponse.threads.length
      });
      
      // Phase 2: Analyze threads with AI
      if (threadsResponse.threads.length === 0) {
        console.warn(`[PersonalContextService] No threads found for analysis`);
        emitLog(`No email threads found for analysis. Try expanding the time range or checking email activity.`);
        return {
          success: false,
          error: 'No email threads found for analysis. Try expanding the time range or checking email activity.'
        };
      }
      
      emitLog(`Phase 2: Analyzing ${threadsResponse.threads.length} threads with AI...`);
      const analysisResult = await personalContextAnalysisService.analyzeEmailThreads(
        threadsResponse.threads,
        gmailProfile.emailAddress
      );
      
      emitLog(`Successfully analyzed ${threadsResponse.threads.length} threads containing ${threadsResponse.threads.reduce((sum, t) => sum + t.messageCount, 0)} emails`);
      emitLog(`Identified ${analysisResult.contactRelationships.length} contacts from your email history`);
      
      await this.updateProgress(input.userId, 'learning', 70, {
        threadsAnalyzed: threadsResponse.threads.length,
        emailsAnalyzed: threadsResponse.threads.reduce((sum, t) => sum + t.messageCount, 0),
        contactsClassified: analysisResult.contactRelationships.length
      });
      
      // Phase 3: Build personal context profile
      emitLog(`Phase 3: Building personal context profile...`);
      const profile = await this.buildPersonalContextProfile(
        input.userId,
        gmailProfile.emailAddress,
        analysisResult,
        threadsResponse.threads,
        input.options
      );
      
      // Phase 4: Save everything to Firestore
      emitLog(`Phase 4: Saving data to database...`);
      await this.savePersonalContextData(input.userId, profile, analysisResult);
      
      await this.updateProgress(input.userId, 'complete', 100);
      
      console.log(`[PersonalContextService] Successfully completed personal context learning`);
      emitLog(`Successfully completed personal context learning`);
      
      return {
        success: true,
        profile
      };
      
    } catch (error) {
      console.error('[PersonalContextService] Error during personal context learning:', error);
      emitLog(`Error: ${(error as Error).message}`);
      
      await this.updateProgress(input.userId, 'error', undefined, undefined, (error as Error).message);
      
      return {
        success: false,
        error: `Learning failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Updates personal context with new email interactions
   */
  async updatePersonalContext(input: PersonalContextUpdateInput): Promise<{
    success: boolean;
    updates?: string[];
    error?: string;
  }> {
    try {
      console.log(`[PersonalContextService] Updating personal context for user: ${input.userId}`);
      
      // Get existing personal context
      const existingProfile = await personalContextStore.getPersonalContext(input.userId);
      if (!existingProfile) {
        return {
          success: false,
          error: 'No existing personal context found. Please run initial learning first.'
        };
      }
      
      // Analyze the new email interaction
      // This is a simplified version - could be enhanced with more sophisticated analysis
      const updates: string[] = [];
      
      // Update communication patterns if we have a thread context
      if (input.threadContext) {
        const contactEmail = input.recipientEmail;
        const existingPattern = existingProfile.communicationPatterns.contactSpecificStyles[contactEmail];
        
        // Simple pattern update logic
        if (existingPattern) {
          existingPattern.sampleCount += 1;
          existingPattern.lastUpdated = new Date();
          updates.push(`Updated communication pattern for ${contactEmail}`);
        } else {
          // Create new pattern - simplified for now
          const newPattern: ContactCommunicationStyle = {
            contactEmail,
            style: existingProfile.communicationPatterns.globalStyle, // Use global style as baseline
            confidence: 0.3, // Low confidence for single interaction
            lastUpdated: new Date(),
            sampleCount: 1
          };
          
          existingProfile.communicationPatterns.contactSpecificStyles[contactEmail] = newPattern;
          updates.push(`Created new communication pattern for ${contactEmail}`);
        }
        
        // Update contact relationship
        const existingRelationship = existingProfile.relationships.contacts[contactEmail];
        if (existingRelationship) {
          existingRelationship.lastInteraction = new Date();
          existingRelationship.totalInteractions += 1;
          updates.push(`Updated relationship data for ${contactEmail}`);
        }
      }
      
      // Update the profile metadata
      existingProfile.lastUpdated = new Date();
      existingProfile.version += 1;
      
      // Save updates
      await personalContextStore.updatePersonalContext(input.userId, existingProfile);
      
      console.log(`[PersonalContextService] Successfully updated personal context with ${updates.length} changes`);
      
      return {
        success: true,
        updates
      };
      
    } catch (error) {
      console.error('[PersonalContextService] Error updating personal context:', error);
      
      return {
        success: false,
        error: `Update failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Gets personal context for a user
   */
  async getPersonalContext(userId: string): Promise<PersonalContextProfile | null> {
    try {
      return await personalContextStore.getPersonalContext(userId);
    } catch (error) {
      console.error(`[PersonalContextService] Error getting personal context for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Gets learning progress for a user
   */
  async getLearningProgress(userId: string): Promise<LearningProgress | null> {
    try {
      return await personalContextStore.getLearningProgress(userId);
    } catch (error) {
      console.error(`[PersonalContextService] Error getting learning progress for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Gets user statistics
   */
  async getUserStatistics(userId: string): Promise<{
    hasPersonalContext: boolean;
    contactCount: number;
    patternCount: number;
    lastUpdated?: Date;
    confidence?: number;
  } | null> {
    try {
      return await personalContextStore.getUserStatistics(userId);
    } catch (error) {
      console.error(`[PersonalContextService] Error getting user statistics for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Deletes all personal context data for a user
   */
  async deletePersonalContextData(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await personalContextStore.deletePersonalContextData(userId);
      console.log(`[PersonalContextService] Successfully deleted personal context data for user: ${userId}`);
      
      return { success: true };
    } catch (error) {
      console.error(`[PersonalContextService] Error deleting personal context data for user ${userId}:`, error);
      
      return {
        success: false,
        error: `Delete failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Tests Gmail connection
   */
  async testGmailConnection(accessToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      const isConnected = await gmailService.testConnection(accessToken);
      
      if (isConnected) {
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Gmail connection test failed. Please check your access token.'
        };
      }
    } catch (error) {
      console.error('[PersonalContextService] Error testing Gmail connection:', error);
      
      return {
        success: false,
        error: `Connection test failed: ${(error as Error).message}`
      };
    }
  }

  // Private helper methods
  
  private async updateProgress(
    userId: string,
    phase: LearningProgress['currentPhase'],
    progress?: number,
    updates?: Partial<LearningProgress>,
    error?: string
  ): Promise<void> {
    try {
      const existingProgress = await personalContextStore.getLearningProgress(userId);
      if (!existingProgress) {
        // If we can't get existing progress, just log and continue
        console.warn(`[PersonalContextService] No existing progress found for user ${userId}, skipping progress update`);
        return;
      }
      
      const updatedProgress: Partial<LearningProgress> = {
        currentPhase: phase,
        status: error ? 'failed' : (phase === 'complete' ? 'completed' : 'running'),
        ...updates
      };
      
      if (progress !== undefined) {
        updatedProgress.progress = progress;
      }
      
      if (error) {
        updatedProgress.lastError = error;
      }
      
      if (phase === 'complete') {
        updatedProgress.estimatedCompletion = new Date();
      }
      
      await personalContextStore.updateLearningProgress(userId, updatedProgress);
    } catch (updateError: any) {
      console.warn('[PersonalContextService] Failed to update progress:', updateError);
      
      // If Firestore isn't available, don't fail the learning process
      if (updateError?.message?.includes('Firestore database is not properly set up')) {
        console.warn('[PersonalContextService] Firestore not available, continuing learning without progress tracking');
        return;
      }
      
      // For other errors, continue but log the warning
      console.warn('[PersonalContextService] Continuing learning despite progress update failure');
    }
  }

  private async buildPersonalContextProfile(
    userId: string,
    userEmail: string,
    analysisResult: Awaited<ReturnType<typeof personalContextAnalysisService.analyzeEmailThreads>>,
    threads: any[],
    options: PersonalContextLearningInput['options']
  ): Promise<PersonalContextProfile> {
    const now = new Date();
    
    // Build contact relationships map
    const contactsMap: Record<string, ContactRelationship> = {};
    for (const contact of analysisResult.contactRelationships) {
      contactsMap[contact.contactEmail] = {
        contactEmail: contact.contactEmail,
        relationshipType: contact.category,
        confidence: contact.confidence,
        communicationFrequency: 'monthly', // Default, could be enhanced
        responseTimePattern: 'business_hours', // Default, could be enhanced
        communicationInitiator: 'mutual', // Default, could be enhanced
        sharedContexts: [], // Could be enhanced
        lastInteraction: now,
        totalInteractions: 1, // Default, could be enhanced
        averageResponseTime: 1440 // 24 hours default
      };
    }
    
    // Build contact-specific communication styles map
    const contactStylesMap: Record<string, ContactCommunicationStyle> = {};
    // This would be populated with more detailed analysis
    
    // Build learning metadata
    const learningMetadata: LearningMetadata = {
      emailsAnalyzed: threads.reduce((sum, t) => sum + t.messageCount, 0),
      threadsAnalyzed: threads.length,
      contactsClassified: analysisResult.contactRelationships.length,
      lastFullAnalysis: now,
      analysisTimeRange: {
        startDate: this.getAnalysisStartDate(options.timeRange),
        endDate: now
      },
      confidenceScores: {
        overall: analysisResult.confidence,
        communicationStyle: analysisResult.confidence,
        relationships: analysisResult.confidence,
        professionalProfile: analysisResult.confidence,
        personalPreferences: analysisResult.confidence
      },
      learningSource: 'historical_analysis'
    };
    
    const profile: PersonalContextProfile = {
      id: userId,
      userId,
      version: 1,
      confidence: analysisResult.confidence,
      lastAnalyzed: now,
      lastUpdated: now,
      communicationPatterns: {
        globalStyle: analysisResult.communicationStyle,
        contactSpecificStyles: contactStylesMap
      },
      relationships: {
        contacts: contactsMap,
        relationshipTypes: analysisResult.contactRelationships.map(c => c.category)
      },
      professionalProfile: this.buildProfessionalProfile(analysisResult.professionalProfile),
      personalPreferences: this.buildPersonalPreferences(analysisResult.personalPreferences),
      
      // Enhanced insights from comprehensive analysis
      behavioralPatterns: analysisResult.behavioralPatterns || [],
      contextualResponses: analysisResult.contextualResponses || [],
      temporalPatterns: analysisResult.temporalPatterns || [],
      knowledgeAreas: analysisResult.knowledgeAreas || [],
      
      learningMetadata
    };
    
    return profile;
  }

  private buildProfessionalProfile(partial: Partial<ProfessionalProfile>): ProfessionalProfile {
    // Create a clean copy without undefined values
    const cleanPartial = Object.entries(partial || {}).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    
    return {
      // Set default values for all fields
      jobTitle: cleanPartial.jobTitle || 'Professional',
      company: cleanPartial.company || 'Unknown Company',
      industry: cleanPartial.industry || 'Technology',
      department: cleanPartial.department || 'General',
      managementLevel: cleanPartial.managementLevel || 'individual',
      expertise: cleanPartial.expertise || [],
      workingHours: cleanPartial.workingHours || {
        timezone: 'UTC',
        startHour: 9,
        endHour: 17,
        workDays: [1, 2, 3, 4, 5] // Monday-Friday
      },
      meetingPatterns: cleanPartial.meetingPatterns || {
        preferredDuration: 30,
        preferredTimes: ['10:00 AM', '2:00 PM'],
        meetingStyle: 'formal'
      },
      projectsAndResponsibilities: cleanPartial.projectsAndResponsibilities || [],
      networkingStyle: cleanPartial.networkingStyle || 'selective',
      decisionMakingAuthority: cleanPartial.decisionMakingAuthority || []
    };
  }

  private buildPersonalPreferences(partial: Partial<PersonalPreferences>): PersonalPreferences {
    // Create a clean copy without undefined values
    const cleanPartial = Object.entries(partial || {}).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    
    return {
      responseTimingPatterns: cleanPartial.responseTimingPatterns || {
        businessHours: true,
        eveningEmails: false,
        weekendEmails: false,
        urgentResponseTime: 4,
        normalResponseTime: 24
      },
      communicationPreferences: cleanPartial.communicationPreferences || {
        preferredChannels: ['email'],
        formalityByContext: {},
        topicPreferences: [],
        avoidanceTopics: []
      },
      decisionMakingStyle: cleanPartial.decisionMakingStyle || 'deliberate',
      conflictResolutionApproach: cleanPartial.conflictResolutionApproach || 'diplomatic',
      schedulingPreferences: cleanPartial.schedulingPreferences || {
        preferredMeetingTimes: ['10:00 AM', '2:00 PM'],
        bufferTimeNeeded: 15,
        backToBackTolerance: false
      },
      personalInterests: cleanPartial.personalInterests || [],
      valuesAndBeliefs: cleanPartial.valuesAndBeliefs || []
    };
  }

  private async savePersonalContextData(
    userId: string,
    profile: PersonalContextProfile,
    analysisResult: Awaited<ReturnType<typeof personalContextAnalysisService.analyzeEmailThreads>>
  ): Promise<void> {
    try {
      // Save main profile
      await personalContextStore.savePersonalContext(userId, profile);
      
      // Save contact relationships in batch
      const relationships = analysisResult.contactRelationships.map(contact => ({
        contactEmail: contact.contactEmail,
        relationship: profile.relationships.contacts[contact.contactEmail]
      }));
      
      if (relationships.length > 0) {
        await personalContextStore.saveBatchContactRelationships(userId, relationships);
      }
      
      // Save communication patterns in batch
      const patterns = Object.entries(profile.communicationPatterns.contactSpecificStyles).map(
        ([contactEmail, pattern]) => ({ contactEmail, pattern })
      );
      
      if (patterns.length > 0) {
        await personalContextStore.saveBatchCommunicationPatterns(userId, patterns);
      }
      
      console.log('[PersonalContextService] Successfully saved all personal context data');
    } catch (saveError: any) {
      console.warn('[PersonalContextService] Failed to save personal context data to Firestore:', saveError);
      
      // If Firestore isn't available, log a helpful message but don't fail the learning
      if (saveError?.message?.includes('Firestore database is not properly set up')) {
        console.warn('[PersonalContextService] Firestore not available - personal context was analyzed but not persisted. Please set up Firestore to save data permanently.');
        return;
      }
      
      // For other save errors, still continue
      console.warn('[PersonalContextService] Personal context analysis completed but data persistence failed');
    }
  }

  private getAnalysisStartDate(timeRange: PersonalContextLearningInput['options']['timeRange']): Date {
    const now = new Date();
    
    switch (timeRange) {
      case 'last_month':
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case 'last_3months':
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case 'last_6months':
        return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case 'last_year':
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case 'last_2years':
        return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      case 'last_3years':
        return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
      case 'last_5years':
        return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      case 'all_time':
        return new Date(2000, 0, 1); // Using a far-back date as a practical "all time" starting point
      default:
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    }
  }
}

export const personalContextService = PersonalContextService.getInstance(); 