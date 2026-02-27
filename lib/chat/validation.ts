import { z } from 'zod';
import { AVAILABLE_MODELS } from '@/lib/ai/models';

export const MessageSchema = z.object({
  role: z.string(),
  content: z.string(),
}).passthrough();

export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  worldState: z.object({}).passthrough(),
  modelId: z.enum(AVAILABLE_MODELS).optional(),
  lastSimulationTick: z.number().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
