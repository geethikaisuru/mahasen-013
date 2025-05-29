import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  EmailThread,
  ThreadAnalysisResult,
  CommunicationInsight,
  RelationshipInsight,
  ProfessionalInsight,
  PersonalInsight,
  CommunicationStyle,
  ContactCategory,
  PersonalContextProfile
} from '@/types/personal-context';

// Helper function to emit logs to the UI
const emitLog = (message: string) => {
  // Log to console first
  console.log(`[AnalysisService] ${message}`);
  
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('personal-context-log', {
      detail: { message, source: 'analysis' }
    });
    window.dispatchEvent(event);
  }
};

export class PersonalContextAnalysisService {
  private static instance: PersonalContextAnalysisService;
  
  private constructor() {}
  
  public static getInstance(): PersonalContextAnalysisService {
    if (!PersonalContextAnalysisService.instance) {
      PersonalContextAnalysisService.instance = new PersonalContextAnalysisService();
    }
    return PersonalContextAnalysisService.instance;
  }

  /**
   * Analyzes multiple email threads to extract comprehensive personal context
   */
  async analyzeEmailThreads(
    threads: EmailThread[], 
    userEmail: string
  ): Promise<{
    communicationStyle: CommunicationStyle;
    contactRelationships: Array<{ contactEmail: string; category: ContactCategory; confidence: number }>;
    professionalProfile: Partial<PersonalContextProfile['professionalProfile']>;
    personalPreferences: Partial<PersonalContextProfile['personalPreferences']>;
    confidence: number;
  }> {
    try {
      console.log(`[AnalysisService] Starting analysis of ${threads.length} threads for ${userEmail}`);
      emitLog(`Starting AI analysis of ${threads.length} email threads...`);
      
      // Analyze threads in batches for efficiency
      const batchSize = 5;
      const threadAnalyses: ThreadAnalysisResult[] = [];
      
      for (let i = 0; i < threads.length; i += batchSize) {
        const batch = threads.slice(i, i + batchSize);
        emitLog(`Analyzing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(threads.length/batchSize)} (${batch.length} threads)`);
        const batchResults = await this.analyzeBatchThreads(batch, userEmail);
        threadAnalyses.push(...batchResults);
        
        // Small delay between batches to avoid rate limits
        if (i + batchSize < threads.length) {
          await this.delay(500);
        }
      }
      
      // Aggregate insights from all thread analyses
      emitLog(`Aggregating insights from ${threadAnalyses.length} analyzed threads...`);
      const aggregatedInsights = this.aggregateInsights(threadAnalyses);
      
      // Log summary of findings
      emitLog(`Analysis complete - Identified communication style: ${aggregatedInsights.communicationStyle.tone}`);
      emitLog(`Found ${aggregatedInsights.contactRelationships.length} contacts with defined relationships`);
      
      console.log(`[AnalysisService] Completed analysis with ${aggregatedInsights.confidence}% confidence`);
      return aggregatedInsights;
      
    } catch (error) {
      console.error('[AnalysisService] Error analyzing email threads:', error);
      emitLog(`Error during AI analysis: ${(error as Error).message}`);
      throw new Error(`Analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Analyzes a single email thread for insights
   */
  async analyzeSingleThread(thread: EmailThread, userEmail: string): Promise<ThreadAnalysisResult> {
    try {
      const userMessages = thread.messages.filter(m => m.isFromUser);
      const otherMessages = thread.messages.filter(m => !m.isFromUser);
      
      if (userMessages.length === 0) {
        return this.createEmptyAnalysisResult(thread.threadId);
      }

      const threadSubject = thread.subject.substring(0, 30) + (thread.subject.length > 30 ? '...' : '');
      emitLog(`Analyzing thread: "${threadSubject}" (${thread.messages.length} messages)`);

      const analysisPrompt = this.buildThreadAnalysisPrompt(thread, userEmail);
      
      const threadAnalysisPrompt = ai.definePrompt({
        name: 'threadAnalysisPrompt',
        input: { schema: z.object({ content: z.string() }) },
        output: { schema: z.object({ analysis: z.string() }) },
        prompt: analysisPrompt
      });

      const { output } = await threadAnalysisPrompt({ content: '' });
      
      const result = this.parseAnalysisResult(output?.analysis || '', thread.threadId);
      
      // Log some insights found
      if (result.relationshipInsights.length > 0) {
        const contacts = result.relationshipInsights.map(r => r.contactEmail).join(', ');
        emitLog(`Found relationship insights for: ${contacts}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`[AnalysisService] Error analyzing thread ${thread.threadId}:`, error);
      emitLog(`Failed to analyze thread: ${(error as Error).message}`);
      return this.createEmptyAnalysisResult(thread.threadId);
    }
  }

  /**
   * Analyzes a batch of threads concurrently
   */
  private async analyzeBatchThreads(
    threads: EmailThread[], 
    userEmail: string
  ): Promise<ThreadAnalysisResult[]> {
    const promises = threads.map(thread => this.analyzeSingleThread(thread, userEmail));
    return Promise.all(promises);
  }

  /**
   * Builds the analysis prompt for a thread
   */
  private buildThreadAnalysisPrompt(thread: EmailThread, userEmail: string): string {
    const userMessages = thread.messages.filter(m => m.isFromUser);
    const participants = thread.participants.filter(p => p !== userEmail);
    
    const threadSummary = {
      subject: thread.subject,
      participants: participants.slice(0, 3), // Limit for prompt size
      messageCount: thread.messageCount,
      userMessageCount: userMessages.length,
      timeSpan: `${thread.firstMessageDate.toDateString()} to ${thread.lastMessageDate.toDateString()}`,
      category: thread.threadCategory
    };

    const sampleUserMessages = userMessages.slice(0, 3).map(m => ({
      to: m.to.slice(0, 2), // Limit recipients
      body: m.body.substring(0, 500) + (m.body.length > 500 ? '...' : ''), // Limit body length
      timestamp: m.timestamp.toISOString()
    }));

    return `You are an expert at analyzing communication patterns and personal context from email threads. 

Analyze this email thread to extract insights about the user's communication style, relationships, and professional context.

Thread Summary:
${JSON.stringify(threadSummary, null, 2)}

Sample User Messages:
${JSON.stringify(sampleUserMessages, null, 2)}

Please analyze and provide insights in the following JSON format:

{
  "communicationInsights": [
    {
      "type": "tone|formality|response_pattern|style_variation",
      "description": "Brief description of the insight",
      "evidence": ["specific examples from the messages"],
      "confidence": 0.0-1.0,
      "contactEmail": "email if contact-specific"
    }
  ],
  "relationshipInsights": [
    {
      "contactEmail": "email address",
      "suggestedCategory": "family|close_friends|work_colleagues|clients_customers|executives_bosses|vendors_service_providers|unknown_cold_outreach|academic_contacts|community_organization|government_official",
      "evidence": ["indicators that support this categorization"],
      "confidence": 0.0-1.0,
      "communicationPattern": "description of how they interact"
    }
  ],
  "professionalInsights": [
    {
      "type": "role|company|expertise|responsibility|authority",
      "value": "extracted value",
      "evidence": ["supporting evidence from messages"],
      "confidence": 0.0-1.0
    }
  ],
  "personalInsights": [
    {
      "type": "preference|interest|schedule|decision_style|communication_preference",
      "value": "extracted value",
      "evidence": ["supporting evidence"],
      "confidence": 0.0-1.0
    }
  ]
}

Focus on:
1. Communication tone and style patterns
2. Relationship dynamics and professional hierarchies
3. Time preferences and scheduling patterns
4. Decision-making style and authority level
5. Personal interests or values that surface in communication

Be conservative with confidence scores. Only assign high confidence (>0.8) when there is clear, repeated evidence.`;
  }

  /**
   * Parses AI analysis result into structured format
   */
  private parseAnalysisResult(analysisText: string, threadId: string): ThreadAnalysisResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[AnalysisService] No JSON found in analysis result for thread ${threadId}`);
        return this.createEmptyAnalysisResult(threadId);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        threadId,
        communicationInsights: parsed.communicationInsights || [],
        relationshipInsights: parsed.relationshipInsights || [],
        professionalInsights: parsed.professionalInsights || [],
        personalInsights: parsed.personalInsights || [],
        confidence: this.calculateOverallConfidence(parsed)
      };
      
    } catch (error) {
      console.error(`[AnalysisService] Error parsing analysis result for thread ${threadId}:`, error);
      return this.createEmptyAnalysisResult(threadId);
    }
  }

  /**
   * Aggregates insights from multiple thread analyses
   */
  private aggregateInsights(analyses: ThreadAnalysisResult[]): {
    communicationStyle: CommunicationStyle;
    contactRelationships: Array<{ contactEmail: string; category: ContactCategory; confidence: number }>;
    professionalProfile: Partial<PersonalContextProfile['professionalProfile']>;
    personalPreferences: Partial<PersonalContextProfile['personalPreferences']>;
    confidence: number;
  } {
    console.log(`[AnalysisService] Aggregating insights from ${analyses.length} thread analyses`);

    // Aggregate communication insights
    const communicationStyle = this.aggregateCommunicationStyle(analyses);
    
    // Aggregate relationship insights
    const contactRelationships = this.aggregateContactRelationships(analyses);
    
    // Aggregate professional insights
    const professionalProfile = this.aggregateProfessionalProfile(analyses);
    
    // Aggregate personal insights
    const personalPreferences = this.aggregatePersonalPreferences(analyses);
    
    // Calculate overall confidence
    const overallConfidence = this.calculateAggregatedConfidence(analyses);

    return {
      communicationStyle,
      contactRelationships,
      professionalProfile,
      personalPreferences,
      confidence: overallConfidence
    };
  }

  /**
   * Aggregates communication style insights
   */
  private aggregateCommunicationStyle(analyses: ThreadAnalysisResult[]): CommunicationStyle {
    const allCommunicationInsights = analyses.flatMap(a => a.communicationInsights);
    
    // Determine dominant tone
    const toneInsights = allCommunicationInsights.filter(i => i.type === 'tone');
    const dominantTone = this.findDominantValue(toneInsights.map(i => i.description)) as CommunicationStyle['tone'] || 'professional';
    
    // Determine formality level (1-10 scale)
    const formalityInsights = allCommunicationInsights.filter(i => i.type === 'formality');
    const formality = this.estimateFormalityLevel(formalityInsights);
    
    // Extract greeting and closing styles
    const greetingStyles = this.extractPatterns(allCommunicationInsights, 'greeting');
    const closingStyles = this.extractPatterns(allCommunicationInsights, 'closing');
    
    return {
      tone: dominantTone,
      formality: formality,
      greetingStyle: greetingStyles.slice(0, 3), // Top 3
      closingStyle: closingStyles.slice(0, 3), // Top 3
      sentenceStructure: 'medium', // Default, could be enhanced
      emojiUsage: 'minimal', // Default, could be enhanced
      punctuationStyle: 'standard', // Default, could be enhanced
      responseLength: 'moderate', // Default, could be enhanced
      languagePreferences: ['English'] // Default, could be enhanced
    };
  }

  /**
   * Aggregates contact relationship insights
   */
  private aggregateContactRelationships(analyses: ThreadAnalysisResult[]): Array<{ contactEmail: string; category: ContactCategory; confidence: number }> {
    const relationshipMap = new Map<string, { categories: ContactCategory[]; confidences: number[] }>();
    
    analyses.forEach(analysis => {
      analysis.relationshipInsights.forEach(insight => {
        const existing = relationshipMap.get(insight.contactEmail) || { categories: [], confidences: [] };
        existing.categories.push(insight.suggestedCategory);
        existing.confidences.push(insight.confidence);
        relationshipMap.set(insight.contactEmail, existing);
      });
    });
    
    const relationships: Array<{ contactEmail: string; category: ContactCategory; confidence: number }> = [];
    
    relationshipMap.forEach((data, contactEmail) => {
      const dominantCategory = this.findDominantValue(data.categories) as ContactCategory;
      const avgConfidence = data.confidences.reduce((sum, conf) => sum + conf, 0) / data.confidences.length;
      
      relationships.push({
        contactEmail,
        category: dominantCategory || 'unknown_cold_outreach',
        confidence: avgConfidence
      });
    });
    
    return relationships;
  }

  /**
   * Aggregates professional profile insights
   */
  private aggregateProfessionalProfile(analyses: ThreadAnalysisResult[]): Partial<PersonalContextProfile['professionalProfile']> {
    const professionalInsights = analyses.flatMap(a => a.professionalInsights);
    
    const roleInsights = professionalInsights.filter(i => i.type === 'role');
    const companyInsights = professionalInsights.filter(i => i.type === 'company');
    const expertiseInsights = professionalInsights.filter(i => i.type === 'expertise');
    const responsibilityInsights = professionalInsights.filter(i => i.type === 'responsibility');
    const authorityInsights = professionalInsights.filter(i => i.type === 'authority');
    
    return {
      jobTitle: this.findDominantValue(roleInsights.map(i => i.value)),
      company: this.findDominantValue(companyInsights.map(i => i.value)),
      expertise: this.extractUniqueValues(expertiseInsights.map(i => i.value)).slice(0, 5),
      projectsAndResponsibilities: this.extractUniqueValues(responsibilityInsights.map(i => i.value)).slice(0, 10),
      decisionMakingAuthority: this.extractUniqueValues(authorityInsights.map(i => i.value)).slice(0, 5),
      managementLevel: this.inferManagementLevel(authorityInsights, responsibilityInsights)
    };
  }

  /**
   * Aggregates personal preference insights
   */
  private aggregatePersonalPreferences(analyses: ThreadAnalysisResult[]): Partial<PersonalContextProfile['personalPreferences']> {
    const personalInsights = analyses.flatMap(a => a.personalInsights);
    
    const scheduleInsights = personalInsights.filter(i => i.type === 'schedule');
    const preferenceInsights = personalInsights.filter(i => i.type === 'preference');
    const decisionStyleInsights = personalInsights.filter(i => i.type === 'decision_style');
    
    return {
      responseTimingPatterns: this.inferResponsePatterns(scheduleInsights),
      decisionMakingStyle: this.findDominantValue(decisionStyleInsights.map(i => i.value)) as any || 'deliberate',
      personalInterests: this.extractUniqueValues(preferenceInsights.map(i => i.value)).slice(0, 10)
    };
  }

  /**
   * Utility methods
   */
  private findDominantValue(values: string[]): string | undefined {
    if (values.length === 0) return undefined;
    
    const counts = new Map<string, number>();
    values.forEach(value => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    
    let maxCount = 0;
    let dominantValue = '';
    counts.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count;
        dominantValue = value;
      }
    });
    
    return dominantValue;
  }

  private extractUniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.filter(v => v && v.trim().length > 0)));
  }

  private extractPatterns(insights: CommunicationInsight[], pattern: string): string[] {
    return insights
      .filter(i => i.description.toLowerCase().includes(pattern))
      .flatMap(i => i.evidence)
      .slice(0, 10);
  }

  private estimateFormalityLevel(formalityInsights: CommunicationInsight[]): number {
    // Default to moderate formality
    if (formalityInsights.length === 0) return 5;
    
    // Simple heuristic based on insight descriptions
    const descriptions = formalityInsights.map(i => i.description.toLowerCase());
    
    if (descriptions.some(d => d.includes('very formal') || d.includes('highly formal'))) return 8;
    if (descriptions.some(d => d.includes('formal'))) return 7;
    if (descriptions.some(d => d.includes('professional'))) return 6;
    if (descriptions.some(d => d.includes('casual'))) return 4;
    if (descriptions.some(d => d.includes('very casual') || d.includes('informal'))) return 3;
    
    return 5; // Default moderate
  }

  private inferManagementLevel(
    authorityInsights: ProfessionalInsight[], 
    responsibilityInsights: ProfessionalInsight[]
  ): PersonalContextProfile['professionalProfile']['managementLevel'] {
    const allInsights = [...authorityInsights, ...responsibilityInsights];
    const values = allInsights.map(i => i.value.toLowerCase());
    
    if (values.some(v => v.includes('ceo') || v.includes('president') || v.includes('executive'))) {
      return 'executive';
    }
    if (values.some(v => v.includes('director') || v.includes('vp') || v.includes('head of'))) {
      return 'director';
    }
    if (values.some(v => v.includes('manager') || v.includes('lead') || v.includes('supervisor'))) {
      return 'manager';
    }
    if (values.some(v => v.includes('team lead') || v.includes('senior'))) {
      return 'team_lead';
    }
    
    return 'individual';
  }

  private inferResponsePatterns(scheduleInsights: PersonalInsight[]): PersonalContextProfile['personalPreferences']['responseTimingPatterns'] {
    // Simple heuristics based on schedule insights
    const evidence = scheduleInsights.flatMap(i => i.evidence).join(' ').toLowerCase();
    
    return {
      businessHours: !evidence.includes('after hours') && !evidence.includes('late night'),
      eveningEmails: evidence.includes('evening') || evidence.includes('after 6'),
      weekendEmails: evidence.includes('weekend') || evidence.includes('saturday') || evidence.includes('sunday'),
      urgentResponseTime: evidence.includes('immediate') ? 1 : 4, // hours
      normalResponseTime: evidence.includes('quick') ? 4 : 24 // hours
    };
  }

  private calculateOverallConfidence(parsed: any): number {
    const allInsights = [
      ...(parsed.communicationInsights || []),
      ...(parsed.relationshipInsights || []),
      ...(parsed.professionalInsights || []),
      ...(parsed.personalInsights || [])
    ];
    
    if (allInsights.length === 0) return 0;
    
    const avgConfidence = allInsights.reduce((sum: number, insight: any) => sum + (insight.confidence || 0), 0) / allInsights.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  private calculateAggregatedConfidence(analyses: ThreadAnalysisResult[]): number {
    if (analyses.length === 0) return 0;
    
    const avgConfidence = analyses.reduce((sum, analysis) => sum + analysis.confidence, 0) / analyses.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  private createEmptyAnalysisResult(threadId: string): ThreadAnalysisResult {
    return {
      threadId,
      communicationInsights: [],
      relationshipInsights: [],
      professionalInsights: [],
      personalInsights: [],
      confidence: 0
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const personalContextAnalysisService = PersonalContextAnalysisService.getInstance(); 