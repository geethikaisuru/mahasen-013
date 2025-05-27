import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the chat prompt
const chatPrompt = ai.definePrompt({
  name: 'chatPrompt',
  input: { schema: z.object({ message: z.string() }) },
  output: { schema: z.object({ response: z.string() }) },
  prompt: `You are a helpful AI assistant. Respond to the user's message in a conversational and helpful manner.

User message: {{message}}

Provide a helpful, informative, and friendly response.`,
});

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Use GenKit chat prompt to generate response
    const { output } = await chatPrompt({ message });

    if (!output) {
      throw new Error('No response generated');
    }

    return NextResponse.json({
      response: output.response,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response. Please check your API key configuration.' },
      { status: 500 }
    );
  }
} 