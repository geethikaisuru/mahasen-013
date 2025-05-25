'use server';

/**
 * @fileOverview Generates three draft email replies based on email content and user context.
 *
 * - generateEmailDrafts - A function that generates three email draft replies.
 * - GenerateEmailDraftsInput - The input type for the generateEmailDrafts function.
 * - GenerateEmailDraftsOutput - The return type for the generateEmailDrafts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateEmailDraftsInputSchema = z.object({
  emailContent: z.string().describe('The content of the email to reply to.'),
  userContext: z.string().describe('The personal context of the user.'),
});
export type GenerateEmailDraftsInput = z.infer<typeof GenerateEmailDraftsInputSchema>;

const GenerateEmailDraftsOutputSchema = z.object({
  drafts: z.array(
    z.string().describe('A draft email reply.')
  ).length(3).describe('Three draft email replies.'),
});
export type GenerateEmailDraftsOutput = z.infer<typeof GenerateEmailDraftsOutputSchema>;

export async function generateEmailDrafts(input: GenerateEmailDraftsInput): Promise<GenerateEmailDraftsOutput> {
  return generateEmailDraftsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEmailDraftsPrompt',
  input: {schema: GenerateEmailDraftsInputSchema},
  output: {schema: GenerateEmailDraftsOutputSchema},
  prompt: `You are an AI email assistant that generates three distinct draft replies to an email, incorporating the user's personal context where appropriate.\n\nEmail Content: {{{emailContent}}}\n\nUser Context: {{{userContext}}}\n\nGenerate three different email replies that the user can choose from. The replies should vary in tone and content, but all should be relevant to the email and the user's context.  Return the replies in an array called "drafts".`,
});

const generateEmailDraftsFlow = ai.defineFlow(
  {
    name: 'generateEmailDraftsFlow',
    inputSchema: GenerateEmailDraftsInputSchema,
    outputSchema: GenerateEmailDraftsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
