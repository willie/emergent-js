import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// Model selection by task
export const models = {
  // Main conversation - high quality narrative
  mainConversation: 'z-ai/glm-4.6:exacto',
  // Off-screen simulation - same quality for character consistency
  offscreenSimulation: 'z-ai/glm-4.6:exacto',
  // Quick tasks - summaries, extraction, logic analysis
  fast: 'openai/gpt-4o-mini',
  // Embeddings
  embedding: 'openai/text-embedding-3-small',
} as const;

export function getModel(task: keyof typeof models) {
  return openrouter(models[task]);
}
