import { NextRequest, NextResponse } from 'next/server';
import { personalContextService } from '@/services/personal-context/personal-context-service';
import type { PersonalContextLearningInput } from '@/types/personal-context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { userId, accessToken, options } = body;
    
    if (!userId || !accessToken) {
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

    console.log(`[API] Starting personal context learning for user: ${userId}`);
    
    // Start the learning process
    const result = await personalContextService.learnPersonalContext(input);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Personal context learning completed successfully',
        profile: result.profile
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Learning failed' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('[API] Error in personal context learning:', error);
    
    return NextResponse.json(
      { error: `Learning failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
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
    console.error('[API] Error getting learning progress:', error);
    
    return NextResponse.json(
      { error: `Failed to get progress: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 