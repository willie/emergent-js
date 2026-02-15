import type { UIMessage } from "@ai-sdk/react";

// ── Message part interfaces ──────────────────────────────────────────────────

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

// ── Type guards ──────────────────────────────────────────────────────────────

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

export function isToolResult(
  value: unknown,
): value is import("@/lib/chat/tool-processor").ToolResult {
  return typeof value === "object" && value !== null && "type" in value;
}
