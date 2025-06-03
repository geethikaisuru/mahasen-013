import { NextRequest, NextResponse } from 'next/server';
import { personalContextService } from '@/services/personal-context/personal-context-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    console.log(`[API] Getting personal context for draft generation for user: ${userId}`);

    try {
      const profile = await personalContextService.getPersonalContext(userId);
      if (profile) {
        // Format the personal context profile into a string for the AI
        const contextParts = [];
        
        // Communication style
        if (profile.communicationPatterns?.globalStyle) {
          const style = profile.communicationPatterns.globalStyle;
          contextParts.push(`Communication style: ${style.tone || 'professional'} tone, formality level ${style.formality || 5}/10.`);
          if (style.greetingStyle?.length > 0) {
            contextParts.push(`Preferred greetings: ${style.greetingStyle.join(', ')}.`);
          }
          if (style.closingStyle?.length > 0) {
            contextParts.push(`Preferred sign-offs: ${style.closingStyle.join(', ')}.`);
          }
        }

        // Professional profile
        if (profile.professionalProfile) {
          const prof = profile.professionalProfile;
          if (prof.jobTitle) contextParts.push(`Current role: ${prof.jobTitle}`);
          if (prof.company) contextParts.push(`Company: ${prof.company}`);
          if (prof.department) contextParts.push(`Department: ${prof.department}`);
          if (prof.managementLevel) contextParts.push(`Management level: ${prof.managementLevel}`);
        }

        // Personal preferences
        if (profile.personalPreferences) {
          const prefs = profile.personalPreferences;
          if (prefs.communicationPreferences?.formalityByContext) {
            contextParts.push(`Formality preferences: ${JSON.stringify(prefs.communicationPreferences.formalityByContext)}`);
          }
          if (prefs.decisionMakingStyle) {
            contextParts.push(`Decision making style: ${prefs.decisionMakingStyle}`);
          }
        }

        // Add current date context
        contextParts.push(`Today is ${new Date().toLocaleDateString()}.`);

        const formattedContext = contextParts.join(' ');
        
        return NextResponse.json({
          success: true,
          userContext: formattedContext,
          hasProfile: true
        });
      } else {
        // No profile found, return fallback context
        const fallbackContext = "I am a busy professional. I prefer concise and direct communication. Today is " + new Date().toLocaleDateString() + ".";
        
        return NextResponse.json({
          success: true,
          userContext: fallbackContext,
          hasProfile: false
        });
      }
    } catch (error) {
      console.error("Error fetching personal context:", error);
      
      // Return fallback context on error
      const fallbackContext = "I am a busy professional. I prefer concise and direct communication. Today is " + new Date().toLocaleDateString() + ".";
      
      return NextResponse.json({
        success: true,
        userContext: fallbackContext,
        hasProfile: false,
        error: (error as Error).message
      });
    }
    
  } catch (error) {
    console.error('[API] Error in personal context for draft endpoint:', error);
    
    return NextResponse.json(
      { error: `Failed to get personal context: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 