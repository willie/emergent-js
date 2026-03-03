export interface TextPart {
  type: "text";
  text: string;
}

export function isTextPart(part: unknown): part is TextPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: string }).type === "text" &&
    "text" in part
  );
}

export const CONTINUE_TRIGGER = "__SURAT_CONTINUE__";

/**
 * Check whether a message is a continue-trigger (sent programmatically, not by the user).
 */
export function isContinueTrigger(message: { role: string; parts?: unknown[]; content?: string }): boolean {
  if (message.role !== "user") return false;

  // Check parts array (AI SDK UIMessage format)
  if (Array.isArray(message.parts)) {
    const textPart = message.parts.find(isTextPart);
    if (textPart?.text === CONTINUE_TRIGGER) return true;
  }

  // Check content string (raw message format)
  if (typeof message.content === "string" && message.content === CONTINUE_TRIGGER) return true;

  return false;
}
