// src/app/actions.ts
"use server";

import { generateEmailDrafts as genDrafts, GenerateEmailDraftsInput, GenerateEmailDraftsOutput } from "@/ai/flows/generate-email-drafts";
import { regenerateEmailDrafts as regenDrafts, RegenerateEmailDraftsInput, RegenerateEmailDraftsOutput } from "@/ai/flows/regenerate-email-drafts";

export async function handleGenerateEmailDrafts(input: GenerateEmailDraftsInput): Promise<GenerateEmailDraftsOutput | { error: string }> {
  try {
    const result = await genDrafts(input);
    // The AI flow in generate-email-drafts.ts already ensures 'drafts' is an array of 3 strings.
    // If it's not, the schema validation in the flow would have caught it.
    // However, if the output schema changes, we might need to adapt here.
    // For now, we assume the flow returns the correct structure or throws an error.
    if (!result || !result.drafts || result.drafts.length !== 3) {
        // This case should ideally be handled by robust error handling or schema validation within the AI flow.
        // If the flow can return partial or malformed data without throwing, this check is a fallback.
        console.error("AI returned unexpected draft format:", result);

        // Let's try to pad with empty strings if some drafts are missing, to maintain UI consistency
        // This is a workaround; the ideal solution is to ensure the AI flow is robust.
        const drafts = result?.drafts || [];
        const paddedDrafts = Array(3).fill("").map((_, i) => drafts[i] || "Error: Could not generate draft.");
        return { drafts: paddedDrafts as [string, string, string] };
    }
    return result;
  } catch (error) {
    console.error("Error generating email drafts:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    // Return a structure that the client can still use, e.g., with error messages as drafts
    return {
      drafts: [
        `Error generating draft 1: ${errorMessage}`,
        `Error generating draft 2: ${errorMessage}`,
        `Error generating draft 3: ${errorMessage}`
      ] as [string, string, string] // Ensure type compatibility
    };
  }
}


export async function handleRegenerateEmailDrafts(input: RegenerateEmailDraftsInput): Promise<RegenerateEmailDraftsOutput | { error: string }> {
  try {
    const result = await regenDrafts(input);
    // The regenerateEmailDrafts flow uses 'draftReplies' in its output schema.
    // It is expected to return an array of strings. For consistency with generateEmailDrafts,
    // we expect 3 drafts. If it doesn't, we'll pad or truncate.
    const drafts = result?.draftReplies || [];
    
    let finalDrafts: [string, string, string];

    if (drafts.length === 3) {
      finalDrafts = drafts as [string, string, string];
    } else if (drafts.length > 3) {
      finalDrafts = drafts.slice(0, 3) as [string, string, string];
    } else {
      // Pad with error messages if fewer than 3 drafts are returned
      const padded = [...drafts];
      while (padded.length < 3) {
        padded.push("Error: Could not regenerate draft.");
      }
      finalDrafts = padded as [string, string, string];
    }
    
    return { draftReplies: finalDrafts };

  } catch (error) {
    console.error("Error regenerating email drafts:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return {
      draftReplies: [
        `Error regenerating draft 1: ${errorMessage}`,
        `Error regenerating draft 2: ${errorMessage}`,
        `Error regenerating draft 3: ${errorMessage}`
      ] as [string, string, string]
    };
  }
}
