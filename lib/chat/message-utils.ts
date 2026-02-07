import type { UIMessage } from '@ai-sdk/react';

export function getToolKeysForMessage(message: UIMessage): string[] {
  const keys: string[] = [];
  for (const part of message.parts) {
    if (part.type.startsWith('tool-')) {
      keys.push(`${message.id}-${part.type}`);
    }
  }
  return keys;
}
