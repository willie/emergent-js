import { z } from "zod";

export const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    }).passthrough()
  ),
  worldState: z.object({}).passthrough(),
  modelId: z.string().optional(),
  lastSimulationTick: z.number().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
