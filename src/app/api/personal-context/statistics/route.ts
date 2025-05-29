import { NextRequest, NextResponse } from 'next/server';
import { personalContextService } from '@/services/personal-context/personal-context-service';

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

    // Get user statistics
    const statistics = await personalContextService.getUserStatistics(userId);
    
    if (!statistics) {
      return NextResponse.json(
        { error: 'Failed to get user statistics' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      statistics
    });
    
  } catch (error) {
    console.error('[API] Error getting user statistics:', error);
    
    return NextResponse.json(
      { error: `Failed to get statistics: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 