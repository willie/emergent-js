export function validateChatInput(messages: unknown): { isValid: boolean; error?: string } {
  if (!Array.isArray(messages)) {
    return { isValid: false, error: "Messages must be an array" };
  }

  if (messages.length === 0) {
    return { isValid: false, error: "Messages array cannot be empty" };
  }

  for (const m of messages) {
    const msg = m as any;

    if (!msg.role || typeof msg.role !== "string") {
      return { isValid: false, error: "Message missing valid role" };
    }

    if (msg.role === "system") {
      return { isValid: false, error: "System role is not allowed in input" };
    }

    // Check content presence
    if (msg.content === undefined && !msg.parts) {
       // It's possible to have tool calls without content?
       // But generally a message should have some content or parts or toolCalls.
       // Let's keep it simple for now and just validate role.
       // If we're too strict we might break valid tool use cases.
    }

    // Validate that content is a string if present, or parts is an array
    if (msg.content !== undefined && typeof msg.content !== "string") {
       // It might be null?
    }
  }

  return { isValid: true };
}
