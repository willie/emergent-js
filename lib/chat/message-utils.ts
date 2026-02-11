import type { UIMessage } from "@ai-sdk/react";
import type { ToolResult } from "@/lib/chat/tool-processor";

export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  result: unknown;
}

export interface DynamicToolPart {
  type: string;
  state?: string;
  output?: unknown;
  toolCallId?: string;
}

export function isTextPart(part: unknown): part is TextPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: string }).type === "text" &&
    "text" in part
  );
}

export function isToolResultPart(part: unknown): part is ToolResultPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: string }).type === "tool-result"
  );
}

export function isDynamicToolPart(part: unknown): part is DynamicToolPart {
  if (typeof part !== "object" || part === null) return false;
  const p = part as { type?: string };
  return typeof p.type === "string" && p.type.startsWith("tool-");
}

export function isToolResult(value: unknown): value is ToolResult {
  return typeof value === "object" && value !== null && "type" in value;
}

export function getToolKeysForMessage(message: UIMessage): string[] {
  const keys: string[] = [];
  const m = message as any;

  // 1. Tool Invocations
  if (m.toolInvocations) {
    m.toolInvocations.forEach((t: any) => {
      // key used by processToolResult is messageId-toolCallId
      keys.push(`${message.id}-${t.toolCallId}`);
    });
  }

  // 2. Parts
  for (const part of message.parts) {
    if (isToolResultPart(part)) {
      keys.push(`${message.id}-${part.toolCallId}`);
    } else if (isDynamicToolPart(part)) {
      const p = part as any;
      if (p.toolCallId) {
        keys.push(`${message.id}-${p.toolCallId}`);
      } else {
        // Fallback key format from MainChatPanel healing
        keys.push(`${message.id}-${message.id}-${part.type}`);
        // Also add the simpler key used by legacy MessageActions just in case
        keys.push(`${message.id}-${part.type}`);
      }
    }
  }

  return keys;
}
