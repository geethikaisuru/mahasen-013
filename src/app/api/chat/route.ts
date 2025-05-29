import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { personalContextService } from '@/services/personal-context/personal-context-service';

// Define the enhanced chat prompt that includes personal context
const chatPrompt = ai.definePrompt({
  name: 'chatPrompt',
  input: { 
    schema: z.object({ 
      message: z.string(),
      personalContext: z.string().optional(),
      communicationStyle: z.string().optional()
    }) 
  },
  output: { schema: z.object({ response: z.string() }) },
  prompt: `You are a helpful AI assistant with knowledge of the user's personal context and communication preferences.

{{#if personalContext}}
User's Personal Context:
{{personalContext}}

{{/if}}
{{#if communicationStyle}}
User's Communication Style:
{{communicationStyle}}

Please respond in a way that matches the user's preferred communication style and takes into account their personal context.
{{/if}}

User message: {{message}}

Provide a helpful, informative, and friendly response that is tailored to the user's context and communication preferences.`,
});

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Get personal context if userId is provided
    let personalContext = '';
    let communicationStyle = '';
    
    if (userId) {
      try {
        const profile = await personalContextService.getPersonalContext(userId);
        
        if (profile) {
          // Build personal context summary
          const contextParts = [];
          
          if (profile.professionalProfile.jobTitle) {
            contextParts.push(`Job Title: ${profile.professionalProfile.jobTitle}`);
          }
          
          if (profile.professionalProfile.company) {
            contextParts.push(`Company: ${profile.professionalProfile.company}`);
          }
          
          if (profile.professionalProfile.expertise.length > 0) {
            contextParts.push(`Expertise: ${profile.professionalProfile.expertise.join(', ')}`);
          }
          
          if (profile.personalPreferences.personalInterests.length > 0) {
            contextParts.push(`Interests: ${profile.personalPreferences.personalInterests.join(', ')}`);
          }
          
          personalContext = contextParts.join('\n');
          
          // Build communication style summary
          const style = profile.communicationPatterns.globalStyle;
          const styleParts = [
            `Tone: ${style.tone}`,
            `Formality Level: ${style.formality}/10`,
            `Preferred Response Length: ${style.responseLength}`,
            `Decision Making Style: ${profile.personalPreferences.decisionMakingStyle}`
          ];
          
          if (style.greetingStyle.length > 0) {
            styleParts.push(`Greeting Style: ${style.greetingStyle.join(', ')}`);
          }
          
          if (style.closingStyle.length > 0) {
            styleParts.push(`Closing Style: ${style.closingStyle.join(', ')}`);
          }
          
          communicationStyle = styleParts.join('\n');
        }
      } catch (error) {
        console.warn('Failed to fetch personal context:', error);
        // Continue without personal context
      }
    }

    // Use GenKit chat prompt to generate response
    const { output } = await chatPrompt({ 
      message,
      personalContext: personalContext || undefined,
      communicationStyle: communicationStyle || undefined
    });

    if (!output) {
      throw new Error('No response generated');
    }

    return NextResponse.json({
      response: output.response,
      timestamp: new Date().toISOString(),
      hasPersonalContext: !!personalContext
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response. Please check your API key configuration.' },
      { status: 500 }
    );
  }
} 