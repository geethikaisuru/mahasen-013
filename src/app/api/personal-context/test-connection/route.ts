import { NextRequest, NextResponse } from 'next/server';
import { personalContextService } from '@/services/personal-context/personal-context-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken } = body;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing accessToken' },
        { status: 400 }
      );
    }

    // Test Gmail connection
    const result = await personalContextService.testGmailConnection(accessToken);
    
    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Gmail connection successful' : 'Gmail connection failed',
      error: result.error
    });
    
  } catch (error) {
    console.error('[API] Error testing Gmail connection:', error);
    
    return NextResponse.json(
      { error: `Connection test failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 