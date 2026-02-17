import { type UIMessage } from "ai";
import { type WorldState } from "../../types/world";
import { isValidModel } from "../ai/models";

export function validateChatInput(body: any) {
  if (!body || typeof body !== 'object') {
    throw new Error("Invalid request body");
  }

  const { messages, worldState, modelId } = body;

  if (!Array.isArray(messages)) {
    throw new Error("messages must be an array");
  }

  // Security Check: Prevent prompt injection via system role
  // We check for 'role' property on messages.
  const hasSystemMessage = messages.some((m: any) => m.role === 'system');
  if (hasSystemMessage) {
    throw new Error("System messages are not allowed in input");
  }

  if (!worldState || typeof worldState !== 'object') {
     throw new Error("worldState is required and must be an object");
  }

  const validModelId = modelId && isValidModel(modelId) ? modelId : undefined;

  return {
    messages: messages as UIMessage[],
    worldState: worldState as WorldState,
    modelId: validModelId
  };
}
