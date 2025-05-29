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
      
      await personalContextStore.saveLearningProgress(input.userId, initialProgress);
      
      // Phase 1: Discover Gmail threads
      await this.updateProgress(input.userId, 'discovery', 10);
      
      // Get user's Gmail profile first
      const gmailProfile = await gmailService.getUserProfile(input.accessToken);
      if (!gmailProfile) {
        throw new Error('Failed to access Gmail profile');
      }
      
      console.log(`[PersonalContextService] Fetching threads for ${gmailProfile.emailAddress}`);
      
      const threadsResponse = await gmailService.fetchInteractiveThreads(
        input.accessToken,
        gmailProfile.emailAddress,
        input.options
      );
      
      console.log(`[PersonalContextService] Discovered ${threadsResponse.threads.length} interactive threads`);
      
      await this.updateProgress(input.userId, 'analysis', 30, {
        threadsDiscovered: threadsResponse.threads.length
      });
      
      // Phase 2: Analyze threads with AI
      if (threadsResponse.threads.length === 0) {
        console.warn(`[PersonalContextService] No threads found for analysis`);
        return {
          success: false,
          error: 'No email threads found for analysis. Try expanding the time range or checking email activity.'
        };
      }
      
      const analysisResult = await personalContextAnalysisService.analyzeEmailThreads(
        threadsResponse.threads,
        gmailProfile.emailAddress
      );
      
      await this.updateProgress(input.userId, 'learning', 70, {
        threadsAnalyzed: threadsResponse.threads.length,
        emailsAnalyzed: threadsResponse.threads.reduce((sum, t) => sum + t.messageCount, 0),
        contactsClassified: analysisResult.contactRelationships.length
      });
      
      // Phase 3: Build personal context profile
      const profile = await this.buildPersonalContextProfile(
        input.userId,
        gmailProfile.emailAddress,
        analysisResult,
        threadsResponse.threads,
        input.options
      );
      
      // Phase 4: Save everything to Firestore
      await this.savePersonalContextData(input.userId, profile, analysisResult);
      
      await this.updateProgress(input.userId, 'complete', 100);
      
      console.log(`[PersonalContextService] Successfully completed personal context learning`);
      
      return {
        success: true,
        profile
      };
      
    } catch (error) {
      console.error('[PersonalContextService] Error during personal context learning:', error);
      
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
      if (!existingProgress) return;
      
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
    } catch (updateError) {
      console.warn('[PersonalContextService] Failed to update progress:', updateError);
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
      learningMetadata
    };
    
    return profile;
  }

  private buildProfessionalProfile(partial: Partial<ProfessionalProfile>): ProfessionalProfile {
    return {
      managementLevel: partial.managementLevel || 'individual',
      expertise: partial.expertise || [],
      meetingPatterns: {
        preferredDuration: 30,
        preferredTimes: ['10:00 AM', '2:00 PM'],
        meetingStyle: 'formal'
      },
      projectsAndResponsibilities: partial.projectsAndResponsibilities || [],
      networkingStyle: 'selective',
      decisionMakingAuthority: partial.decisionMakingAuthority || [],
      ...partial
    };
  }

  private buildPersonalPreferences(partial: Partial<PersonalPreferences>): PersonalPreferences {
    return {
      responseTimingPatterns: partial.responseTimingPatterns || {
        businessHours: true,
        eveningEmails: false,
        weekendEmails: false,
        urgentResponseTime: 4,
        normalResponseTime: 24
      },
      communicationPreferences: {
        preferredChannels: ['email'],
        formalityByContext: {},
        topicPreferences: [],
        avoidanceTopics: []
      },
      decisionMakingStyle: partial.decisionMakingStyle || 'deliberate',
      conflictResolutionApproach: 'diplomatic',
      schedulingPreferences: {
        preferredMeetingTimes: ['10:00 AM', '2:00 PM'],
        bufferTimeNeeded: 15,
        backToBackTolerance: false
      },
      personalInterests: partial.personalInterests || [],
      valuesAndBeliefs: []
    };
  }

  private async savePersonalContextData(
    userId: string,
    profile: PersonalContextProfile,
    analysisResult: Awaited<ReturnType<typeof personalContextAnalysisService.analyzeEmailThreads>>
  ): Promise<void> {
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
      default:
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    }
  }
}

export const personalContextService = PersonalContextService.getInstance(); 