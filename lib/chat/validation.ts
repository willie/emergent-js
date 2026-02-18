import { z } from 'zod';

const MessageSchema = z.object({
  role: z.string(),
  content: z.union([z.string(), z.array(z.any())]),
  parts: z.array(z.any()).optional(), // For AI SDK V3 compatibility
}).passthrough();

const WorldStateSchema = z.object({}).passthrough();

export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  worldState: WorldStateSchema,
  modelId: z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * Validates the chat request payload for structure and security.
 *
 * Security checks:
 * 1. Ensure `messages` is an array.
 * 2. Ensure no message has role 'system' (anti-prompt-injection).
 * 3. Ensure total payload size is reasonable (< 500KB).
 */
export function validateChatRequest(data: unknown): ChatRequest {
  const result = ChatRequestSchema.safeParse(data);

  if (!result.success) {
    // Handle ZodError structure robustly
    const issues = result.error.errors || (result.error as any).issues || [];

    const errorMsg = issues.length > 0
        ? issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        : result.error.message || "Unknown validation error";

    throw new Error(`Invalid request format: ${errorMsg}`);
  }

  const { messages } = result.data;

  // Security Check: System Message Injection
  const hasSystemMessage = messages.some((m: any) => m.role === 'system');
  if (hasSystemMessage) {
    throw new Error("Security Violation: System messages are not allowed in input.");
  }

  // Security Check: Payload Size (rough estimate)
  const totalLength = JSON.stringify(messages).length;
  if (totalLength > 500000) {
    throw new Error("Request payload too large (max 500KB).");
  }

  return result.data;
}
