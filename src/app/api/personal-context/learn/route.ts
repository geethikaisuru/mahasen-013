import { NextRequest, NextResponse } from 'next/server';
import { personalContextService } from '@/services/personal-context/personal-context-service';
import type { PersonalContextLearningInput } from '@/types/personal-context';

// Helper function for server-side logging that will be captured by the UI
const serverLog = (message: string) => {
  console.log(`[PersonalContextAPI] ${message}`);
};

export async function POST(request: NextRequest) {
  try {
    serverLog('API route called - Processing request');
    
    // First log the start of the API call with a unique identifier to help synchronize logs
    const apiCallId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    serverLog(`API call started with ID: ${apiCallId}`);
    
    const body = await request.json();
    
    // Validate required fields
    const { userId, accessToken, options } = body;
    
    if (!userId || !accessToken) {
      serverLog(`Missing required fields: userId and accessToken`);
      return NextResponse.json(
        { error: 'Missing required fields: userId and accessToken' },
        { status: 400 }
      );
    }

    // Set default options if not provided
    const learningOptions = {
      timeRange: options?.timeRange || 'last_3months',
      analysisDepth: options?.analysisDepth || 'standard',
      includePromotional: options?.includePromotional ?? false,
      minThreadLength: options?.minThreadLength || 2,
      ...options
    };

    const input: PersonalContextLearningInput = {
      userId,
      accessToken,
      options: learningOptions
    };

    serverLog(`Starting personal context learning for user: ${userId}`);
    serverLog(`Learning options: ${JSON.stringify({
      timeRange: learningOptions.timeRange,
      analysisDepth: learningOptions.analysisDepth,
      includePromotional: learningOptions.includePromotional,
      minThreadLength: learningOptions.minThreadLength
    })}`);
    
    // Start the learning process
    const result = await personalContextService.learnPersonalContext(input);

    serverLog(`Learning process ${result.success ? 'completed successfully' : 'failed'}`);
    serverLog(`API route response status: ${result.success ? 'success' : 'error'}`);
    serverLog(`API call completed with ID: ${apiCallId}`);
    
    // Return the result with the API call ID for log synchronization
    return NextResponse.json({
      ...result,
      _apiCallId: apiCallId
    });
  } catch (error) {
    serverLog(`Error in learn API: ${(error as Error).message}`);
    serverLog(`API route error stack: ${(error as Error).stack?.slice(0, 200)}...`);
    return NextResponse.json(
      { success: false, error: `API error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      serverLog(`Missing userId parameter`);
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get learning progress
    const progress = await personalContextService.getLearningProgress(userId);
    
    return NextResponse.json({
      success: true,
      progress
    });
    
  } catch (error) {
    serverLog(`Error getting learning progress: ${(error as Error).message}`);
    
    return NextResponse.json(
      { error: `Failed to get progress: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 