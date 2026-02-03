import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// Model selection by task
export const models = {
  // Main conversation - high quality narrative
  mainConversation: 'anthropic/claude-sonnet-4',
  // Off-screen simulation - same quality for character consistency
  offscreenSimulation: 'anthropic/claude-sonnet-4',
  // Quick tasks - summaries, extraction
  fast: 'anthropic/claude-3-5-haiku',
  // Embeddings
  embedding: 'openai/text-embedding-3-small',
} as const;

export function getModel(task: keyof typeof models) {
  return openrouter(models[task]);
}
