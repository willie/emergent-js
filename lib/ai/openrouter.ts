import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// Model selection by task
export const models = {
  // Main conversation - high quality narrative
  mainConversation: 'openai/gpt-oss-120b:exacto',
  // Off-screen simulation - same quality for character consistency
  offscreenSimulation: 'openai/gpt-oss-120b:exacto',
  // Quick tasks - summaries, extraction
  fast: 'openai/gpt-oss-120b:exacto',
  // Embeddings
  embedding: 'openai/text-embedding-3-small',
} as const;

export function getModel(task: keyof typeof models) {
  return openrouter(models[task]);
}
