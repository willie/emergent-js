import { z } from "zod";
import { isValidModel } from "@/lib/ai/models";

// Define message schema
// We strictly forbid 'system' role in input messages to prevent prompt injection
const messageSchema = z.object({
  role: z.string().refine((role) => role !== "system", {
    message: "System role is not allowed in input messages",
  }),
  content: z.any(), // Flexible content (string or array of parts)
}).passthrough();

// Define chat request schema
export const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
  worldState: z.object({}).passthrough(), // Ensure worldState is an object, allow any fields
  modelId: z.string().optional().refine((val) => !val || isValidModel(val), {
    message: "Invalid model ID",
  }),
});

export function validateChatRequest(data: unknown) {
  return chatRequestSchema.safeParse(data);
}
