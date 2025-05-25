import { config } from 'dotenv';
config();

import '@/ai/flows/generate-email-drafts.ts';
import '@/ai/flows/regenerate-email-drafts.ts';