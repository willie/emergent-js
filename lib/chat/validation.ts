import { z } from "zod";
import { isValidModel } from "@/lib/ai/models";

// Basic structure validation for WorldState to prevent runtime crashes
// We use .passthrough() to allow other fields but ensure critical ones exist
export const WorldStateSchema = z
  .object({
    characters: z.array(z.any()),
    playerCharacterId: z.string(),
    locationClusters: z.array(z.any()),
    events: z.array(z.any()),
    scenario: z
      .object({
        description: z.string(),
      })
      .passthrough(),
    time: z
      .object({
        narrativeTime: z.string(),
        tick: z.number(),
      })
      .passthrough(),
  })
  .passthrough();

// Message validation - flexible but structure-aware
export const MessageSchema = z
  .object({
    role: z.string(),
    content: z.union([z.string(), z.array(z.any())]),
  })
  .passthrough();

export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  worldState: WorldStateSchema,
  modelId: z
    .string()
    .optional()
    .refine((val) => !val || isValidModel(val), {
      message: "Invalid model ID",
    }),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
