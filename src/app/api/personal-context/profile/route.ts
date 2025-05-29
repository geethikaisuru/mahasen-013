import { NextRequest, NextResponse } from 'next/server';
import { personalContextService } from '@/services/personal-context/personal-context-service';
import type { PersonalContextUpdateInput } from '@/types/personal-context';

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

    // Get personal context profile
    const profile = await personalContextService.getPersonalContext(userId);
    
    if (!profile) {
      return NextResponse.json(
        { error: 'No personal context found for this user' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      profile
    });
    
  } catch (error) {
    console.error('[API] Error getting personal context profile:', error);
    
    return NextResponse.json(
      { error: `Failed to get profile: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields for updating context
    const { userId, emailContent, recipientEmail, userReply, threadContext } = body;
    
    if (!userId || !emailContent || !recipientEmail || !userReply) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, emailContent, recipientEmail, userReply' },
        { status: 400 }
      );
    }

    const input: PersonalContextUpdateInput = {
      userId,
      emailContent,
      recipientEmail,
      userReply,
      threadContext
    };

    console.log(`[API] Updating personal context for user: ${userId}`);
    
    // Update the personal context
    const result = await personalContextService.updatePersonalContext(input);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Personal context updated successfully',
        updates: result.updates
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Update failed' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('[API] Error updating personal context:', error);
    
    return NextResponse.json(
      { error: `Update failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Delete personal context data
    const result = await personalContextService.deletePersonalContextData(userId);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Personal context data deleted successfully'
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Delete failed' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('[API] Error deleting personal context:', error);
    
    return NextResponse.json(
      { error: `Delete failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 