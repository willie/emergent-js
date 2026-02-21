import { z } from "zod";

export const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "tool", "data"]),
    }).passthrough()
  ),
  worldState: z.object({}).passthrough(),
  modelId: z.string().optional(),
});
