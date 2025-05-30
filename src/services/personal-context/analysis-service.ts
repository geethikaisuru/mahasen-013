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
  PersonalContextProfile,
  BehavioralPattern,
  ContextualResponse,
  TemporalPattern,
  KnowledgeArea
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
    behavioralPatterns: BehavioralPattern[];
    contextualResponses: ContextualResponse[];
    temporalPatterns: TemporalPattern[];
    knowledgeAreas: KnowledgeArea[];
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
      body: m.body.substring(0, 800) + (m.body.length > 800 ? '...' : ''), // Increased body length
      timestamp: m.timestamp.toISOString(),
      subject: m.subject
    }));

    const sampleOtherMessages = thread.messages.filter(m => !m.isFromUser).slice(0, 2).map(m => ({
      from: m.from,
      body: m.body.substring(0, 400) + (m.body.length > 400 ? '...' : ''),
      timestamp: m.timestamp.toISOString()
    }));

    return `You are an expert at analyzing communication patterns and extracting comprehensive personal context from email threads. 

Analyze this email thread to extract detailed insights about the user's communication style, relationships, professional context, personal preferences, and behavioral patterns.

Thread Summary:
${JSON.stringify(threadSummary, null, 2)}

User's Messages:
${JSON.stringify(sampleUserMessages, null, 2)}

Other Participants' Messages:
${JSON.stringify(sampleOtherMessages, null, 2)}

Please analyze and provide comprehensive insights in the following JSON format:

{
  "communicationInsights": [
    {
      "type": "tone|formality|greeting_style|sign_off_style|response_timing|sentence_structure|emoji_usage|punctuation_style|language_preference|style_variation",
      "description": "Detailed description of the communication pattern observed",
      "evidence": ["specific examples from messages"],
      "confidence": 0.0-1.0,
      "contactEmail": "email if contact-specific, null if general pattern",
      "contextual_factors": ["factors that influence this communication style"]
    }
  ],
  "relationshipInsights": [
    {
      "contactEmail": "email address",
      "suggestedCategory": "family|close_friends|work_colleagues|clients_customers|executives_bosses|vendors_service_providers|unknown_cold_outreach|academic_contacts|community_organization|government_official",
      "relationshipDynamics": "description of how they interact (formal, casual, friendly, respectful, etc.)",
      "communicationFrequency": "daily|weekly|monthly|occasional|rare",
      "responseTimePattern": "immediate|within_hours|business_hours|delayed|varies",
      "initiationPattern": "user_initiates|contact_initiates|mutual|unknown",
      "evidence": ["indicators that support this categorization"],
      "confidence": 0.0-1.0,
      "sharedContexts": ["work projects", "personal interests", "family connections", etc.],
      "addressingStyle": "how the user addresses this contact (first name, title, nickname, etc.)"
    }
  ],
  "professionalInsights": [
    {
      "type": "role|company|department|responsibilities|expertise|authority_level|decision_making|meeting_preferences|work_schedule|project_involvement|industry_knowledge|networking_style|management_level|reporting_structure",
      "value": "extracted value or description",
      "evidence": ["supporting evidence from messages"],
      "confidence": 0.0-1.0,
      "context": "additional context about this professional aspect"
    }
  ],
  "personalInsights": [
    {
      "type": "schedule_preference|availability_pattern|family_information|hobby_interest|travel_preference|food_preference|entertainment_choice|value_belief|decision_making_style|conflict_resolution|stress_indicator|privacy_boundary|seasonal_pattern|routine_habit|brand_preference|location_preference|restaurant_preference|shopping_habit|daily_routine|cultural_preference|learning_preference|information_consumption|leisure_activity|sports_team|music_preference|book_preference|movie_preference|technology_preference|social_media_usage|communication_channel_preference",
      "value": "extracted value or description",
      "evidence": ["supporting evidence from messages"],
      "confidence": 0.0-1.0,
      "category": "personal|family|lifestyle|preferences|behavioral|temporal|cultural|entertainment|consumption"
    }
  ],
  "behavioralPatterns": [
    {
      "type": "delegation_comfort|request_handling|invitation_response|urgency_handling|information_sharing|boundary_setting|escalation_trigger|group_dynamics|leadership_style|collaboration_preference",
      "pattern": "description of the behavioral pattern observed",
      "triggers": ["situations that trigger this behavior"],
      "evidence": ["examples from the conversation"],
      "confidence": 0.0-1.0
    }
  ],
  "contextualResponses": [
    {
      "scenario": "description of common scenario (meeting requests, project updates, etc.)",
      "typical_response_style": "how they typically respond to this type of situation",
      "formality_level": "very_low|low|medium|high|very_high",
      "key_phrases": ["common phrases or expressions they use"],
      "evidence": ["examples from messages"],
      "confidence": 0.0-1.0
    }
  ],
  "temporalPatterns": [
    {
      "type": "response_timing|availability_hours|seasonal_behavior|deadline_handling|time_sensitivity",
      "pattern": "description of the temporal pattern",
      "specific_times": ["if applicable, specific times mentioned"],
      "evidence": ["supporting evidence"],
      "confidence": 0.0-1.0
    }
  ],
  "knowledgeAreas": [
    {
      "domain": "specific area of knowledge (technology, industry, hobby, etc.)",
      "expertise_level": "novice|intermediate|advanced|expert",
      "evidence": ["examples showing knowledge in this area"],
      "confidence": 0.0-1.0,
      "context": "how this knowledge is demonstrated"
    }
  ]
}

Focus on extracting:

**Communication Style & Patterns:**
- Tone variation with different contacts (formal, casual, friendly, direct)
- Greeting patterns ("Hi", "Hello", "Hey", professional titles)
- Sign-off preferences ("Best", "Thanks", "Regards", casual endings)
- Response timing patterns and urgency handling
- Sentence structure (short vs long, complexity)
- Emoji and punctuation usage patterns
- Language preferences and regional expressions

**Relationship & Social Context:**
- How they address different people (first names, titles, nicknames)
- Relationship dynamics and communication formality levels
- Shared contexts and common topics of discussion
- Communication frequency and initiation patterns
- Professional vs personal relationship boundaries

**Professional Information:**
- Current role, responsibilities, and authority levels
- Work schedule patterns and availability
- Meeting preferences and scheduling patterns
- Project involvement and professional goals
- Industry knowledge and technical expertise
- Decision-making patterns and delegation comfort
- Management style and team interactions

**Personal Preferences & Habits:**
- Daily routines mentioned in emails
- Travel patterns and location preferences
- Family information and personal relationships
- Hobbies, interests, and entertainment preferences
- Values and beliefs that influence communication
- Stress indicators and busy period behaviors
- Food preferences, favorite restaurants mentioned
- Shopping habits and brand preferences mentioned
- Entertainment choices (movies, music, books, sports teams mentioned)
- Cultural preferences and background indicators
- Learning preferences and information consumption habits
- Technology preferences and social media usage patterns
- Daily routines and lifestyle patterns
- Leisure activities and recreational interests

**Behavioral Patterns:**
- How they handle different types of requests
- Conflict resolution and diplomatic communication
- Privacy boundaries and information sharing comfort
- Group email dynamics vs private communication
- Escalation triggers and when they involve others

**Contextual Adaptations:**
- How communication style changes based on:
  - Recipient type (family, colleagues, clients, executives)
  - Email context (urgent, casual, formal business)
  - Group vs individual communication
  - First contact vs ongoing relationship

Be thorough and extract as much meaningful personal context as possible. Look for subtle patterns in word choice, formality shifts, topics discussed, and relationship dynamics. The goal is to build a comprehensive understanding of how this person communicates and interacts in different contexts.

Assign confidence scores conservatively - only use high confidence (>0.8) when there is clear, repeated evidence across multiple messages.`;
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
        behavioralPatterns: parsed.behavioralPatterns || [],
        contextualResponses: parsed.contextualResponses || [],
        temporalPatterns: parsed.temporalPatterns || [],
        knowledgeAreas: parsed.knowledgeAreas || [],
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
    behavioralPatterns: BehavioralPattern[];
    contextualResponses: ContextualResponse[];
    temporalPatterns: TemporalPattern[];
    knowledgeAreas: KnowledgeArea[];
    confidence: number;
  } {
    console.log(`[AnalysisService] Aggregating insights from ${analyses.length} thread analyses`);

    // Aggregate communication insights
    const communicationStyle = this.aggregateCommunicationStyle(analyses);
    
    // Aggregate relationship insights
    const contactRelationships = this.aggregateContactRelationships(analyses);
    
    // Aggregate professional insights (enhanced)
    const professionalProfile = this.aggregateEnhancedProfessionalProfile(analyses);
    
    // Aggregate personal insights (enhanced)
    const personalPreferences = this.aggregateEnhancedPersonalPreferences(analyses);
    
    // Aggregate new enhanced data types
    const behavioralPatterns = this.aggregateBehavioralPatterns(analyses);
    const contextualResponses = this.aggregateContextualResponses(analyses);
    const temporalPatterns = this.aggregateTemporalPatterns(analyses);
    const knowledgeAreas = this.aggregateKnowledgeAreas(analyses);
    
    // Calculate overall confidence
    const overallConfidence = this.calculateAggregatedConfidence(analyses);

    // Log additional insights for debugging
    emitLog(`Extracted ${behavioralPatterns.length} unique behavioral patterns across all threads`);
    emitLog(`Identified ${contextualResponses.length} contextual response patterns`);
    emitLog(`Found ${temporalPatterns.length} temporal communication patterns`);
    emitLog(`Discovered ${knowledgeAreas.length} areas of expertise/knowledge`);

    return {
      communicationStyle,
      contactRelationships,
      professionalProfile,
      personalPreferences,
      behavioralPatterns,
      contextualResponses,
      temporalPatterns,
      knowledgeAreas,
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
  private aggregateEnhancedProfessionalProfile(analyses: ThreadAnalysisResult[]): Partial<PersonalContextProfile['professionalProfile']> {
    const professionalInsights = analyses.flatMap(a => a.professionalInsights);
    
    const roleInsights = professionalInsights.filter(i => i.type === 'role');
    const companyInsights = professionalInsights.filter(i => i.type === 'company');
    const departmentInsights = professionalInsights.filter(i => i.type === 'department');
    const expertiseInsights = professionalInsights.filter(i => i.type === 'expertise');
    const responsibilityInsights = professionalInsights.filter(i => i.type === 'responsibilities');
    const authorityInsights = professionalInsights.filter(i => i.type === 'authority_level');
    const meetingInsights = professionalInsights.filter(i => i.type === 'meeting_preferences');
    const scheduleInsights = professionalInsights.filter(i => i.type === 'work_schedule');
    const managementInsights = professionalInsights.filter(i => i.type === 'management_level');
    
    return {
      jobTitle: this.findDominantValue(roleInsights.map(i => i.value)),
      company: this.findDominantValue(companyInsights.map(i => i.value)),
      department: this.findDominantValue(departmentInsights.map(i => i.value)),
      expertise: this.extractUniqueValues(expertiseInsights.map(i => i.value)).slice(0, 5),
      projectsAndResponsibilities: this.extractUniqueValues(responsibilityInsights.map(i => i.value)).slice(0, 10),
      decisionMakingAuthority: this.extractUniqueValues(authorityInsights.map(i => i.value)).slice(0, 5),
      managementLevel: this.inferManagementLevel(authorityInsights, responsibilityInsights),
      meetingPatterns: this.inferMeetingPatterns(meetingInsights),
      workingHours: this.inferWorkingHours(scheduleInsights)
    };
  }

  /**
   * Aggregates personal preference insights
   */
  private aggregateEnhancedPersonalPreferences(analyses: ThreadAnalysisResult[]): Partial<PersonalContextProfile['personalPreferences']> {
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
   * Aggregates behavioral patterns from all analyses
   */
  private aggregateBehavioralPatterns(analyses: ThreadAnalysisResult[]): BehavioralPattern[] {
    const allPatterns = analyses.flatMap(a => a.behavioralPatterns || []);
    
    // Group similar patterns by type and merge them
    const patternMap = new Map<string, BehavioralPattern[]>();
    
    allPatterns.forEach(pattern => {
      const existing = patternMap.get(pattern.type) || [];
      existing.push(pattern);
      patternMap.set(pattern.type, existing);
    });
    
    const aggregatedPatterns: BehavioralPattern[] = [];
    
    patternMap.forEach((patterns, type) => {
      if (patterns.length > 0) {
        // Find the most confident pattern of this type
        const bestPattern = patterns.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        // Merge evidence and triggers from all patterns of this type
        const allEvidence = Array.from(new Set(patterns.flatMap(p => p.evidence)));
        const allTriggers = Array.from(new Set(patterns.flatMap(p => p.triggers)));
        const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
        
        aggregatedPatterns.push({
          type: bestPattern.type,
          pattern: bestPattern.pattern,
          triggers: allTriggers.slice(0, 5), // Top 5 triggers
          evidence: allEvidence.slice(0, 3), // Top 3 evidence
          confidence: avgConfidence
        });
      }
    });
    
    return aggregatedPatterns;
  }

  /**
   * Aggregates contextual responses from all analyses
   */
  private aggregateContextualResponses(analyses: ThreadAnalysisResult[]): ContextualResponse[] {
    const allResponses = analyses.flatMap(a => a.contextualResponses || []);
    
    // Group by scenario and merge similar ones
    const responseMap = new Map<string, ContextualResponse[]>();
    
    allResponses.forEach(response => {
      const scenarioKey = response.scenario.toLowerCase().substring(0, 20); // Group similar scenarios
      const existing = responseMap.get(scenarioKey) || [];
      existing.push(response);
      responseMap.set(scenarioKey, existing);
    });
    
    const aggregatedResponses: ContextualResponse[] = [];
    
    responseMap.forEach((responses) => {
      if (responses.length > 0) {
        const bestResponse = responses.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        const allPhrases = Array.from(new Set(responses.flatMap(r => r.key_phrases)));
        const allEvidence = Array.from(new Set(responses.flatMap(r => r.evidence)));
        const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
        
        aggregatedResponses.push({
          scenario: bestResponse.scenario,
          typical_response_style: bestResponse.typical_response_style,
          formality_level: bestResponse.formality_level,
          key_phrases: allPhrases.slice(0, 6), // Top 6 phrases
          evidence: allEvidence.slice(0, 3), // Top 3 evidence
          confidence: avgConfidence
        });
      }
    });
    
    return aggregatedResponses;
  }

  /**
   * Aggregates temporal patterns from all analyses
   */
  private aggregateTemporalPatterns(analyses: ThreadAnalysisResult[]): TemporalPattern[] {
    const allPatterns = analyses.flatMap(a => a.temporalPatterns || []);
    
    // Group by type and merge
    const patternMap = new Map<string, TemporalPattern[]>();
    
    allPatterns.forEach(pattern => {
      const existing = patternMap.get(pattern.type) || [];
      existing.push(pattern);
      patternMap.set(pattern.type, existing);
    });
    
    const aggregatedPatterns: TemporalPattern[] = [];
    
    patternMap.forEach((patterns, type) => {
      if (patterns.length > 0) {
        const bestPattern = patterns.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        const allTimes = Array.from(new Set(patterns.flatMap(p => p.specific_times || [])));
        const allEvidence = Array.from(new Set(patterns.flatMap(p => p.evidence)));
        const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
        
        aggregatedPatterns.push({
          type: bestPattern.type,
          pattern: bestPattern.pattern,
          specific_times: allTimes.slice(0, 5), // Top 5 times
          evidence: allEvidence.slice(0, 3), // Top 3 evidence
          confidence: avgConfidence
        });
      }
    });
    
    return aggregatedPatterns;
  }

  /**
   * Aggregates knowledge areas from all analyses
   */
  private aggregateKnowledgeAreas(analyses: ThreadAnalysisResult[]): KnowledgeArea[] {
    const allAreas = analyses.flatMap(a => a.knowledgeAreas || []);
    
    // Group by domain and merge
    const areaMap = new Map<string, KnowledgeArea[]>();
    
    allAreas.forEach(area => {
      const domainKey = area.domain.toLowerCase().trim();
      const existing = areaMap.get(domainKey) || [];
      existing.push(area);
      areaMap.set(domainKey, existing);
    });
    
    const aggregatedAreas: KnowledgeArea[] = [];
    
    areaMap.forEach((areas) => {
      if (areas.length > 0) {
        // Use the highest expertise level found
        const expertiseLevels = ['novice', 'intermediate', 'advanced', 'expert'];
        const highestLevel = areas.reduce((highest, current) => {
          const currentLevel = expertiseLevels.indexOf(current.expertise_level);
          const highestLevel = expertiseLevels.indexOf(highest.expertise_level);
          return currentLevel > highestLevel ? current : highest;
        });
        
        const allEvidence = Array.from(new Set(areas.flatMap(a => a.evidence)));
        const avgConfidence = areas.reduce((sum, a) => sum + a.confidence, 0) / areas.length;
        
        aggregatedAreas.push({
          domain: highestLevel.domain,
          expertise_level: highestLevel.expertise_level,
          evidence: allEvidence.slice(0, 3), // Top 3 evidence
          confidence: avgConfidence,
          context: highestLevel.context
        });
      }
    });
    
    return aggregatedAreas;
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

  private inferMeetingPatterns(meetingInsights: ProfessionalInsight[]): PersonalContextProfile['professionalProfile']['meetingPatterns'] {
    const evidence = meetingInsights.flatMap(i => i.evidence).join(' ').toLowerCase();
    const values = meetingInsights.map(i => i.value.toLowerCase());
    
    // Extract preferred duration
    let preferredDuration = 30; // default
    if (evidence.includes('30 min') || evidence.includes('half hour')) {
      preferredDuration = 30;
    } else if (evidence.includes('60 min') || evidence.includes('one hour') || evidence.includes('1 hour')) {
      preferredDuration = 60;
    } else if (evidence.includes('15 min') || evidence.includes('quick')) {
      preferredDuration = 15;
    }
    
    // Extract preferred times
    const preferredTimes: string[] = [];
    if (evidence.includes('morning')) preferredTimes.push('9:00 AM', '10:00 AM');
    if (evidence.includes('afternoon')) preferredTimes.push('2:00 PM', '3:00 PM');
    if (evidence.includes('late morning')) preferredTimes.push('11:00 AM');
    
    // Determine meeting style
    let meetingStyle: 'formal' | 'casual' | 'mixed' = 'mixed';
    if (evidence.includes('formal') || evidence.includes('structured')) {
      meetingStyle = 'formal';
    } else if (evidence.includes('casual') || evidence.includes('informal')) {
      meetingStyle = 'casual';
    }
    
    return {
      preferredDuration,
      preferredTimes: preferredTimes.length > 0 ? preferredTimes : ['10:00 AM', '2:00 PM'],
      meetingStyle
    };
  }

  private inferWorkingHours(scheduleInsights: ProfessionalInsight[]): PersonalContextProfile['professionalProfile']['workingHours'] {
    const evidence = scheduleInsights.flatMap(i => i.evidence).join(' ').toLowerCase();
    
    // Extract timezone
    let timezone = 'UTC';
    if (evidence.includes('pst') || evidence.includes('pacific')) timezone = 'America/Los_Angeles';
    if (evidence.includes('est') || evidence.includes('eastern')) timezone = 'America/New_York';
    if (evidence.includes('cst') || evidence.includes('central')) timezone = 'America/Chicago';
    if (evidence.includes('mst') || evidence.includes('mountain')) timezone = 'America/Denver';
    
    // Extract work hours
    let startHour = 9;
    let endHour = 17;
    
    if (evidence.includes('8am') || evidence.includes('8:00')) startHour = 8;
    if (evidence.includes('9am') || evidence.includes('9:00')) startHour = 9;
    if (evidence.includes('10am') || evidence.includes('10:00')) startHour = 10;
    
    if (evidence.includes('5pm') || evidence.includes('17:00')) endHour = 17;
    if (evidence.includes('6pm') || evidence.includes('18:00')) endHour = 18;
    if (evidence.includes('7pm') || evidence.includes('19:00')) endHour = 19;
    
    // Extract work days
    let workDays = [1, 2, 3, 4, 5]; // Default Monday-Friday
    if (evidence.includes('weekend') && !evidence.includes('no weekend')) {
      workDays = [0, 1, 2, 3, 4, 5, 6]; // Include weekends
    }
    
    return {
      timezone,
      startHour,
      endHour,
      workDays
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
      behavioralPatterns: [],
      contextualResponses: [],
      temporalPatterns: [],
      knowledgeAreas: [],
      confidence: 0
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const personalContextAnalysisService = PersonalContextAnalysisService.getInstance(); 