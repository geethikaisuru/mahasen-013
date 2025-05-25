// regenerate-email-drafts.ts
'use server';

/**
 * @fileOverview A flow to regenerate email drafts based on the email content and user's personal context.
 *
 * - regenerateEmailDrafts - A function that handles the regeneration of email drafts.
 * - RegenerateEmailDraftsInput - The input type for the regenerateEmailDrafts function.
 * - RegenerateEmailDraftsOutput - The return type for the regenerateEmailDrafts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RegenerateEmailDraftsInputSchema = z.object({
  emailContent: z.string().describe('The content of the email to reply to.'),
  userContext: z.string().describe('The user\u2019s personal context to incorporate into the reply.'),
});
export type RegenerateEmailDraftsInput = z.infer<typeof RegenerateEmailDraftsInputSchema>;

const RegenerateEmailDraftsOutputSchema = z.object({
  draftReplies: z.array(z.string()).describe('An array of draft email replies.'),
});
export type RegenerateEmailDraftsOutput = z.infer<typeof RegenerateEmailDraftsOutputSchema>;

export async function regenerateEmailDrafts(input: RegenerateEmailDraftsInput): Promise<RegenerateEmailDraftsOutput> {
  return regenerateEmailDraftsFlow(input);
}

const regenerateEmailDraftsPrompt = ai.definePrompt({
  name: 'regenerateEmailDraftsPrompt',
  input: {schema: RegenerateEmailDraftsInputSchema},
  output: {schema: RegenerateEmailDraftsOutputSchema},
  prompt: `You are an AI assistant specializing in generating email replies.

  Based on the email content and the user's personal context, generate three distinct draft replies.
  Incorporate or omit facts as needed to create relevant and helpful suggestions. Ensure each draft has a different tone and approach.

  Email Content: {{{emailContent}}}
  User Context: {{{userContext}}}

  Output the draft replies as an array of strings.
  `,
});

const regenerateEmailDraftsFlow = ai.defineFlow(
  {
    name: 'regenerateEmailDraftsFlow',
    inputSchema: RegenerateEmailDraftsInputSchema,
    outputSchema: RegenerateEmailDraftsOutputSchema,
  },
  async input => {
    const {output} = await regenerateEmailDraftsPrompt(input);
    return output!;
  }
);
