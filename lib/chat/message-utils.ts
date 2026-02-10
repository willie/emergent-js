import { type UIMessage } from '@ai-sdk/react';
import { type ToolResult } from '@/lib/chat/tool-processor';

export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolInvocation {
  toolCallId: string;
  state: "result" | "call" | "partial-call";
  result?: unknown;
}

export interface MessageWithToolInvocations extends UIMessage {
  toolInvocations?: ToolInvocation[];
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
  for (const part of message.parts) {
    if (part.type.startsWith('tool-')) {
      keys.push(`${message.id}-${part.type}`);
    }
  }
  return keys;
}
